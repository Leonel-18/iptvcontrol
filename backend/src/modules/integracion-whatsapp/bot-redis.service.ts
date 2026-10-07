import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { BotRedisClient } from './bot-rate-limit.service';

@Injectable()
export class BotRedisService implements BotRedisClient, OnModuleDestroy {
  private readonly logger = new Logger(BotRedisService.name);
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
      this.logger.warn(`Redis del rate limit del bot no está disponible: ${error.message}`);
    });
  }

  eval(script: string, numberOfKeys: number, ...args: string[]): Promise<unknown> {
    return this.cliente.eval(script, numberOfKeys, ...args);
  }

  onModuleDestroy(): void {
    this.cliente.disconnect();
  }
}
