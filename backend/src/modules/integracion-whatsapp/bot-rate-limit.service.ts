import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

export const BOT_REDIS_CLIENT = Symbol('BOT_REDIS_CLIENT');

export interface BotRedisClient {
  eval(script: string, numberOfKeys: number, ...args: string[]): Promise<unknown>;
}

export class BotRateLimitExcedidoError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Se alcanzó el límite de solicitudes de la integración.');
    this.name = 'BotRateLimitExcedidoError';
  }
}

const CONSUMIR_SOLICITUD = `
local cantidad = redis.call('INCR', KEYS[1])
if cantidad == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {cantidad, ttl}
`;

@Injectable()
export class BotRateLimitService {
  private readonly logger = new Logger(BotRateLimitService.name);
  private readonly limite: number;
  private readonly ventanaMs: number;

  constructor(
    config: ConfigService,
    @Inject(BOT_REDIS_CLIENT) private readonly redis: BotRedisClient,
  ) {
    this.limite = Math.max(1, config.get<number>('whatsappBot.rateLimit') ?? 30);
    this.ventanaMs = Math.max(1, config.get<number>('whatsappBot.rateWindowSeconds') ?? 60) * 1000;
  }

  async consumir(apiKey: string): Promise<void> {
    const identificador = createHash('sha256').update(apiKey).digest('hex');
    let resultado: unknown;
    try {
      resultado = await this.redis.eval(
        CONSUMIR_SOLICITUD,
        1,
        `iptvcontrol:bot:rate:${identificador}`,
        String(this.ventanaMs),
      );
    } catch (error) {
      this.logger.error(`No se pudo verificar el rate limit del bot: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'La integración no está disponible temporalmente porque no pudo verificar sus límites de seguridad.',
      );
    }

    if (!Array.isArray(resultado) || resultado.length < 2) {
      throw new ServiceUnavailableException(
        'La integración no está disponible temporalmente porque recibió una respuesta inválida del limitador.',
      );
    }
    const [cantidad, ttlMs] = resultado.map(Number);
    if (!Number.isFinite(cantidad) || !Number.isFinite(ttlMs)) {
      throw new ServiceUnavailableException(
        'La integración no está disponible temporalmente porque recibió una respuesta inválida del limitador.',
      );
    }
    if (cantidad > this.limite) {
      throw new BotRateLimitExcedidoError(Math.max(1, Math.ceil(ttlMs / 1000)));
    }
  }
}
