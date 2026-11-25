import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { IntegracionRedisClient } from './integracion-rate-limit.service';

/** Cliente Redis dedicado al rate limit de integraciones. */
@Injectable()
export class IntegracionRedisService implements IntegracionRedisClient, OnModuleDestroy {
  private readonly logger = new Logger(IntegracionRedisService.name);
  private readonly cliente: Redis;

  constructor(config: ConfigService) {
    this.cliente = new Redis({
      host: config.get<string>('redis.host') ?? 'localhost',
      port: config.get<number>('redis.port') ?? 6379,
      password: config.get<string>('redis.password'),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    });
    this.cliente.on('error', (error) => {
      this.logger.warn(`Redis del rate limit de integraciones no está disponible: ${error.message}`);
    });
  }

  eval(script: string, numberOfKeys: number, ...args: string[]): Promise<unknown> {
    return this.cliente.eval(script, numberOfKeys, ...args);
  }

  onModuleDestroy(): void {
    this.cliente.disconnect();
  }
}
