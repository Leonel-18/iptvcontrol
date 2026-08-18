import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppRoutes } from './routes';
import { ProveedorDeSesion } from './lib/session';
import { ProveedorDeTema } from './lib/theme';
import { TooltipProvider } from './components/ui/overlays';
import { ApiError } from './lib/api';
import './index.css';

/**
 * Punto de entrada del panel.
 *
 * Configuración de TanStack Query pensada para un panel operativo:
 *  - `staleTime` de 30 segundos: los listados se consultan seguido mientras se
 *    trabaja, y no tiene sentido pedir lo mismo cada vez que se cambia de
 *    pestaña.
 *  - No se reintenta ante 4xx: si el backend dijo "no tiene permisos", insistir
 *    tres veces no cambia nada y sólo demora el mensaje de error.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (intento, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return intento < 2;
      },
    },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ProveedorDeTema>
        <BrowserRouter>
          <ProveedorDeSesion>
            <TooltipProvider delayDuration={200}>
              <AppRoutes />
              <Toaster
                position="bottom-right"
                closeButton
                toastOptions={{ className: 'font-sans text-sm' }}
              />
            </TooltipProvider>
          </ProveedorDeSesion>
        </BrowserRouter>
      </ProveedorDeTema>
    </QueryClientProvider>
  </StrictMode>,
);
