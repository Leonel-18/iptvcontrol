import { useAuth0 } from '@auth0/auth0-react';
import { AlertTriangle, LogIn } from 'lucide-react';
import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSesion } from '@/lib/session';
import { Alert, Button, Skeleton } from '../ui/primitives';

/**
 * Pantalla de carga mientras se resuelven Auth0 y la sesión del Team Member.
 *
 * Se exporta porque `LandingPage` también la usa: mientras Auth0 está
 * procesando el regreso del login (`isLoading`), no hay que dibujar el
 * contenido público — si no, se ve un flash de la landing antes de que el
 * `useEffect` la mande al panel (caso reportado 25/08/2026).
 */
export const Cargando = ({ mensaje }: { mensaje: string }) => (
  <div className="grid min-h-full place-items-center p-6">
    <div className="w-full max-w-sm space-y-4 text-center">
      <img
        src="/logo_iptvcontrol.png"
        alt="IPTVControl"
        className="mx-auto size-16 object-contain"
      />
      <p className="text-sm texto-suave">{mensaje}</p>
      <div className="space-y-2">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="mx-auto h-2 w-2/3" />
      </div>
    </div>
  </div>
);

/**
 * Pantalla de ingreso.
 *
 * La autenticación la maneja Auth0 con su propia pantalla (personalizable con la
 * marca de IPTVControl), así que acá sólo se explica dónde está parada la persona
 * y se la manda para allá.
 */
const Ingreso = () => {
  const { loginWithRedirect } = useAuth0();

  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-3">
          <img
            src="/logo_iptvcontrol.png"
            alt="IPTVControl"
            className="mx-auto size-24 object-contain"
          />
          <div className="space-y-1">
            <h1 className="font-display text-xl font-bold tracking-tight">
              Panel de administración
            </h1>
            <p className="text-sm texto-suave">
              Ingrese con su cuenta para gestionar cuentas, clientes y dispositivos.
            </p>
          </div>
        </div>

        <Button variant="primary" size="lg" className="w-full" onClick={() => loginWithRedirect()}>
          <LogIn />
          Iniciar sesión
        </Button>

        <p className="text-2xs texto-suave">
          ¿No tiene acceso? Solicíteselo al operador principal: el alta se hace por invitación.
        </p>
      </div>
    </div>
  );
};

/** El usuario se autenticó en Auth0 pero no tiene Team Member habilitado. */
const SinAcceso = ({ mensaje }: { mensaje: string }) => {
  const { logout } = useAuth0();

  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <Alert tone="warning" titulo="Su usuario no tiene acceso habilitado">
          {mensaje}
        </Alert>
        <p className="text-sm texto-suave">
          El acceso a IPTVControl se otorga por invitación. Si le corresponde entrar, pida al
          operador principal que reenvíe la invitación a su correo.
        </p>
        <Button
          variant="secondary"
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        >
          Salir
        </Button>
      </div>
    </div>
  );
};

/** Exige sesión válida con Team Member habilitado. */
export const RequiereSesion = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth0();
  const { sesion, cargando, error } = useSesion();

  if (isLoading) return <Cargando mensaje="Verificando su sesión…" />;
  if (!isAuthenticated) return <Ingreso />;
  if (cargando) return <Cargando mensaje="Cargando su panel…" />;

  if (error) {
    return (
      <SinAcceso
        mensaje={
          error.message ||
          'No pudimos validar su acceso. Verifique con el operador principal que su usuario esté dado de alta.'
        }
      />
    );
  }

  if (!sesion) return <SinAcceso mensaje="No encontramos un perfil asociado a su usuario." />;

  return <>{children}</>;
};

/**
 * Restringe una sección al Operador Principal.
 *
 * No es la única defensa: el backend rechaza igual la operación. Esto evita
 * mostrarle a una Empresa Revendedora una pantalla que no le corresponde.
 */
export const SoloOperador = ({ children }: { children: ReactNode }) => {
  const { esOperador } = useSesion();
  if (!esOperador) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

/** Restringe una sección a las Empresas Revendedoras. */
export const SoloRevendedora = ({ children }: { children: ReactNode }) => {
  const { esRevendedora } = useSesion();
  if (!esRevendedora) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

/** Página inexistente. */
export const NotFound = () => (
  <div className="grid place-items-center py-20 text-center">
    <div className="space-y-3">
      <AlertTriangle className="mx-auto size-10 text-warn" />
      <h1 className="font-display text-xl font-bold">Esta página no existe</h1>
      <p className="text-sm texto-suave">Revise el enlace o vuelva al inicio.</p>
      <Button asChild variant="primary">
        <a href="/dashboard">Ir al inicio</a>
      </Button>
    </div>
  </div>
);
