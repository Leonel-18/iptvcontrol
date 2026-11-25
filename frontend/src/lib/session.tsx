import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  api,
  registrarManejadorDeSesionExpirada,
  registrarProveedorDeToken,
} from './api';

/**
 * URL pública del panel, sin barra final.
 *
 * `VITE_AUTH0_REDIRECT_URI` es la URL canónica (sin www) que ya usa el callback
 * de Auth0. Si no está configurada, en producción se usa el dominio público y
 * en desarrollo el origen actual (localhost).
 */
const urlCanonica = (): string =>
  import.meta.env.VITE_AUTH0_REDIRECT_URI?.replace(/\/$/, '') ||
  (import.meta.env.DEV ? window.location.origin : 'https://iptvcontrol.com.ar');

/**
 * Errores que significan que ya no hay sesión que renovar.
 *
 * Los errores de red no entran acá: una caída momentánea no debe desloguear.
 */
const ERRORES_SESION_PERDIDA = new Set([
  'login_required',
  'consent_required',
  'missing_refresh_token',
  'invalid_grant',
  'unauthorized',
  'access_denied',
  'user_blocked',
]);

const esErrorDeSesionPerdida = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  const codigo = (error as Error & { error?: string }).error;
  if (codigo && ERRORES_SESION_PERDIDA.has(codigo)) return true;

  // auth0-spa-js lanza los refresh tokens inválidos como mensaje, sin código.
  return /missing refresh token|invalid refresh token|user is blocked/i.test(error.message);
};

/** Perfil del Team Member autenticado, tal como lo devuelve `/team-members/me`. */
export interface Sesion {
  id: string;
  email: string;
  nombre: string | null;
  rol: 'operator_admin' | 'operator_staff' | 'reseller_admin' | 'reseller_staff';
  estado: string;
  es_operador: boolean;
  operador_principal: { id: string; nombre: string } | null;
  empresa_revendedora: { id: string; razon_social: string; estado: string } | null;
}

interface ContextoSesion {
  sesion: Sesion | null;
  cargando: boolean;
  error: Error | null;
  /** true si el Team Member pertenece al Operador Principal. */
  esOperador: boolean;
  /** true si pertenece a una Empresa Revendedora. */
  esRevendedora: boolean;
  cerrarSesion: () => void;
}

const SesionContext = createContext<ContextoSesion | null>(null);

/**
 * Envuelve la app con Auth0 y registra el proveedor de token del cliente HTTP.
 *
 * La autenticación vive en Auth0; los PERMISOS los define la tabla
 * `team_member` del backend. Por eso el panel no decide nada a partir de los
 * claims del token: pregunta quién es a `/team-members/me`.
 */
export const ProveedorDeSesion = ({ children }: { children: ReactNode }) => {
  const dominio = import.meta.env.VITE_AUTH0_DOMAIN ?? '';
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID ?? '';
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE ?? '';
  // URL canónica de retorno (sin www). Si no se configura, usa el origen actual
  // (necesario en desarrollo local). En producción se fija con
  // `VITE_AUTH0_REDIRECT_URI=https://iptvcontrol.com.ar` para que Auth0 reciba
  // siempre un callback que esté en la lista permitida, aun si el usuario entró
  // por `www.iptvcontrol.com.ar`.
  const redirectUri = urlCanonica();

  return (
    <Auth0Provider
      domain={dominio}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: audience || undefined,
      }}
      // El token queda en localStorage para que un F5 no obligue a re-loguear.
      cacheLocation="localstorage"
      useRefreshTokens
    >
      <PuenteDeSesion>{children}</PuenteDeSesion>
    </Auth0Provider>
  );
};

const PuenteDeSesion = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading, getAccessTokenSilently, logout } = useAuth0();
  const redirigiendo = useRef(false);

  /**
   * Pérdida de autenticación confirmada (401 del backend o error de renovación
   * irrecuperable).
   *
   * Se limpia SÓLO el estado local de Auth0 (`openUrl: false`: no se llama a
   * `/v2/logout`) y se recarga la landing pública. `replace` evita que el botón
   * "Atrás" vuelva a una ruta privada.
   *
   * El ref (acá) y el flag de `api.ts` evitan redirecciones múltiples cuando
   * varias consultas reciben 401 al mismo tiempo.
   */
  const expirarSesion = useCallback(() => {
    if (redirigiendo.current) return;
    redirigiendo.current = true;

    void logout({ openUrl: false })
      .catch(() => undefined)
      .finally(() => {
        window.location.replace(`${urlCanonica()}/`);
      });
  }, [logout]);

  useEffect(() => {
    registrarManejadorDeSesionExpirada(expirarSesion);
    return () => registrarManejadorDeSesionExpirada(null);
  }, [expirarSesion]);

  useEffect(() => {
    registrarProveedorDeToken(async () => {
      if (!isAuthenticated) return null;
      try {
        return await getAccessTokenSilently();
      } catch (error) {
        // Renovación imposible: la sesión ya no existe. Un error de red no
        // entra acá y se sigue comportando como antes (sin desloguear).
        if (esErrorDeSesionPerdida(error)) expirarSesion();
        return null;
      }
    });
  }, [isAuthenticated, getAccessTokenSilently, expirarSesion]);

  const consulta = useQuery({
    queryKey: ['sesion'],
    queryFn: () => api<Sesion>('/team-members/me'),
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // `/team-members/me` es la consulta que confirma quién es el usuario: si
  // responde 401, la sesión ya no sirve. Se cubre acá además del aviso general
  // de `api.ts` para que el redirect no dependa de que el token haya viajado.
  useEffect(() => {
    if (consulta.error instanceof ApiError && consulta.error.status === 401) {
      expirarSesion();
    }
  }, [consulta.error, expirarSesion]);

  const valor = useMemo<ContextoSesion>(() => {
    const sesion = consulta.data ?? null;
    return {
      sesion,
      cargando: isLoading || (isAuthenticated && consulta.isLoading),
      error: (consulta.error as Error) ?? null,
      esOperador: sesion?.es_operador ?? false,
      esRevendedora: Boolean(sesion && !sesion.es_operador),
      cerrarSesion: () =>
        logout({
          logoutParams: { returnTo: urlCanonica() },
        }),
    };
  }, [consulta.data, consulta.error, consulta.isLoading, isAuthenticated, isLoading, logout]);

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
};

export const useSesion = (): ContextoSesion => {
  const contexto = useContext(SesionContext);
  if (!contexto) {
    throw new Error('useSesion debe usarse dentro de ProveedorDeSesion.');
  }
  return contexto;
};
