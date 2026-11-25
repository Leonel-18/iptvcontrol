import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { RequiereSesion } from './Gates';

const estado = vi.hoisted(() => ({ error: null as Error | null }));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

vi.mock('@/lib/session', () => ({
  useSesion: () => ({
    sesion: null,
    cargando: false,
    error: estado.error,
    esOperador: false,
    esRevendedora: false,
    cerrarSesion: vi.fn(),
  }),
}));

const montar = (error: Error) => {
  estado.error = error;
  return render(
    <RequiereSesion>
      <div>panel privado</div>
    </RequiereSesion>,
  );
};

describe('RequiereSesion — error de la consulta de sesión', () => {
  it('un 401 no muestra la pantalla de acceso no habilitado', () => {
    montar(new ApiError(401, 'Unauthorized'));

    expect(screen.queryByText(/no tiene acceso habilitado/i)).toBeNull();
    expect(screen.getByText(/sesión expiró/i)).toBeInTheDocument();
    expect(screen.queryByText('panel privado')).toBeNull();
  });

  it('un 403 sí muestra la pantalla de acceso no habilitado', () => {
    montar(new ApiError(403, 'No tiene permisos para realizar esta operación.'));

    expect(screen.getByText(/no tiene acceso habilitado/i)).toBeInTheDocument();
    expect(screen.queryByText(/sesión expiró/i)).toBeNull();
  });

  it('un error de red no se confunde con una sesión expirada', () => {
    montar(new ApiError(0, 'No pudimos conectarnos con el servidor. Revise su conexión.'));

    expect(screen.queryByText(/sesión expiró/i)).toBeNull();
    expect(screen.getByText('No pudimos validar su acceso')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
