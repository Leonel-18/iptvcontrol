import { ConfigService } from '@nestjs/config';
import { BotRateLimitExcedidoError, BotRateLimitService } from './bot-rate-limit.service';

describe('BotRateLimitService', () => {
  it('permite hasta 30 solicitudes dentro de la ventana', async () => {
    const redis = { eval: jest.fn().mockResolvedValue([30, 42_000]) };
    const config = {
      get: jest.fn((clave: string) =>
        clave === 'whatsappBot.rateLimit'
          ? 30
          : clave === 'whatsappBot.rateWindowSeconds'
            ? 60
            : undefined,
      ),
    } as unknown as ConfigService;
    const servicio = new BotRateLimitService(config, redis);

    await expect(servicio.consumir('api-key-secreta')).resolves.toBeUndefined();
  });

  it('rechaza la solicitud 31 de la misma API key dentro de 60 segundos', async () => {
    const redis = {
      eval: jest.fn().mockResolvedValue([31, 42_000]),
    };
    const config = {
      get: jest.fn((clave: string) => {
        if (clave === 'whatsappBot.rateLimit') return 30;
        if (clave === 'whatsappBot.rateWindowSeconds') return 60;
        return undefined;
      }),
    } as unknown as ConfigService;
    const servicio = new BotRateLimitService(config, redis);

    const error = await servicio.consumir('api-key-secreta').catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(BotRateLimitExcedidoError);
    if (!(error instanceof BotRateLimitExcedidoError)) throw error;
    expect(error.retryAfterSeconds).toBe(42);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      expect.stringMatching(/^iptvcontrol:bot:rate:/),
      '60000',
    );
  });

  it('falla cerrado cuando Redis no está disponible', async () => {
    const redis = { eval: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    const config = {
      get: jest.fn((clave: string) =>
        clave === 'whatsappBot.rateLimit'
          ? 30
          : clave === 'whatsappBot.rateWindowSeconds'
            ? 60
            : undefined,
      ),
    } as unknown as ConfigService;
    const servicio = new BotRateLimitService(config, redis);

    await expect(servicio.consumir('api-key-secreta')).rejects.toMatchObject({ status: 503 });
  });
});
