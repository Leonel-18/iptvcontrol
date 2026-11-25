import { ConfigService } from '@nestjs/config';
import {
  IntegracionRateLimitExcedidoError,
  IntegracionRateLimitService,
} from './integracion-rate-limit.service';

describe('IntegracionRateLimitService', () => {
  const config = (rateLimit = 30) =>
    ({
      get: jest.fn((clave: string) => {
        if (clave === 'integraciones.rateLimit') return rateLimit;
        if (clave === 'integraciones.rateWindowSeconds') return 60;
        return undefined;
      }),
    }) as unknown as ConfigService;

  it('permite hasta el límite configurado dentro de la ventana', async () => {
    const redis = { eval: jest.fn().mockResolvedValue([30, 42_000]) };
    const servicio = new IntegracionRateLimitService(config(), redis);

    await expect(servicio.consumir('api-key-secreta')).resolves.toBeUndefined();
  });

  it('rechaza la solicitud 31 de la misma key dentro de 60 segundos', async () => {
    const redis = { eval: jest.fn().mockResolvedValue([31, 42_000]) };
    const servicio = new IntegracionRateLimitService(config(), redis);

    const error = await servicio.consumir('api-key-secreta').catch((causa: unknown) => causa);

    expect(error).toBeInstanceOf(IntegracionRateLimitExcedidoError);
    if (!(error instanceof IntegracionRateLimitExcedidoError)) throw error;
    expect(error.retryAfterSeconds).toBe(42);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      expect.stringMatching(/^iptvcontrol:integracion:rate:/),
      '60000',
    );
  });

  it('falla cerrado cuando Redis no está disponible', async () => {
    const redis = { eval: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    const servicio = new IntegracionRateLimitService(config(), redis);

    await expect(servicio.consumir('api-key-secreta')).rejects.toMatchObject({ status: 503 });
  });
});
