import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  api,
  registrarManejadorDeSesionExpirada,
  registrarProveedorDeToken,
} from './api';

/**
 * La respuesta se simula con lo mínimo que usa el cliente (`status`, `ok`,
 * `text`) para no depender de `Response` en jsdom.
 */
const respuesta = (status: number, body: Record<string, unknown> = {}) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

describe('api — aviso de sesión inválida', () => {
  const manejador = vi.fn();

  beforeEach(() => {
    manejador.mockClear();
    registrarProveedorDeToken(async () => 'token-vigente');
    registrarManejadorDeSesionExpirada(manejador);
  });

  afterEach(() => {
    registrarManejadorDeSesionExpirada(null);
    registrarProveedorDeToken(async () => null);
    vi.unstubAllGlobals();
  });

  it('avisa una sola vez aunque varias solicitudes reciban 401 en paralelo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respuesta(401, { message: 'Unauthorized' })),
    );

    const resultados = await Promise.allSettled([api('/team-members/me'), api('/dashboard')]);

    expect(resultados.every((resultado) => resultado.status === 'rejected')).toBe(true);
    expect(manejador).toHaveBeenCalledTimes(1);
  });

  it('no avisa cuando el 401 llega sin token (arranque, antes de registrar el proveedor)', async () => {
    registrarProveedorDeToken(async () => null);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respuesta(401, { message: 'Unauthorized' })),
    );

    await expect(api('/team-members/me')).rejects.toBeInstanceOf(ApiError);

    expect(manejador).not.toHaveBeenCalled();
  });

  it('no trata un 403 como sesión expirada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respuesta(403, { message: 'No tiene permisos.' })),
    );

    await expect(api('/team-members/me')).rejects.toMatchObject({ status: 403 });

    expect(manejador).not.toHaveBeenCalled();
  });

  it('no avisa por una caída de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(api('/team-members/me')).rejects.toMatchObject({ status: 0 });

    expect(manejador).not.toHaveBeenCalled();
  });
});
