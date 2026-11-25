import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

export const INTEGRACION_REDIS_CLIENT = Symbol('INTEGRACION_REDIS_CLIENT');

export interface IntegracionRedisClient {
  eval(script: string, numberOfKeys: number, ...args: string[]): Promise<unknown>;
}

export class IntegracionRateLimitExcedidoError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Se alcanzó el límite de solicitudes de la integración.');
    this.name = 'IntegracionRateLimitExcedidoError';
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

/**
 * Rate limit de las APIs de integración.
 *
 * El bucket es por hash de la key, así que cada Empresa tiene su propio cupo.
 * Es independiente del throttler del panel (que limita por IP).
 */
@Injectable()
export class IntegracionRateLimitService {
  private readonly logger = new Logger(IntegracionRateLimitService.name);
  private readonly limite: number;
  private readonly ventanaMs: number;

  constructor(
    config: ConfigService,
    @Inject(INTEGRACION_REDIS_CLIENT) private readonly redis: IntegracionRedisClient,
  ) {
    this.limite = Math.max(1, config.get<number>('integraciones.rateLimit') ?? 30);
    this.ventanaMs =
      Math.max(1, config.get<number>('integraciones.rateWindowSeconds') ?? 60) * 1000;
  }

  async consumir(apiKey: string): Promise<void> {
    const identificador = createHash('sha256').update(apiKey).digest('hex');
    let resultado: unknown;
    try {
      resultado = await this.redis.eval(
        CONSUMIR_SOLICITUD,
        1,
        `iptvcontrol:integracion:rate:${identificador}`,
        String(this.ventanaMs),
      );
    } catch (error) {
      this.logger.error(
        `No se pudo verificar el rate limit de la integración: ${(error as Error).message}`,
      );
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
      throw new IntegracionRateLimitExcedidoError(Math.max(1, Math.ceil(ttlMs / 1000)));
    }
  }
}
