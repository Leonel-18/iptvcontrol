import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { useQuery } from '@tanstack/react-query';
import { api, registrarProveedorDeToken } from './api';

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

  return (
    <Auth0Provider
      domain={dominio}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
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

  useEffect(() => {
    registrarProveedorDeToken(async () => {
      if (!isAuthenticated) return null;
      try {
        return await getAccessTokenSilently();
      } catch {
        return null;
      }
    });
  }, [isAuthenticated, getAccessTokenSilently]);

  const consulta = useQuery({
    queryKey: ['sesion'],
    queryFn: () => api<Sesion>('/team-members/me'),
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const valor = useMemo<ContextoSesion>(() => {
    const sesion = consulta.data ?? null;
    return {
      sesion,
      cargando: isLoading || (isAuthenticated && consulta.isLoading),
      error: (consulta.error as Error) ?? null,
      esOperador: sesion?.es_operador ?? false,
      esRevendedora: Boolean(sesion && !sesion.es_operador),
      cerrarSesion: () => logout({ logoutParams: { returnTo: window.location.origin } }),
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
