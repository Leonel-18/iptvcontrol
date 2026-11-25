import { Module } from '@nestjs/common';
import { CredencialesIntegracionService } from './credenciales-integracion.service';
import { IntegracionesController } from './integraciones.controller';
import {
  INTEGRACION_REDIS_CLIENT,
  IntegracionRateLimitService,
} from './integracion-rate-limit.service';
import { IntegracionRedisService } from './integracion-redis.service';

/**
 * Infraestructura compartida por las APIs de integración.
 *
 * El bot de WhatsApp y el Portal de Cliente importan este módulo para resolver
 * credenciales y aplicar el mismo rate limit por key.
 */
@Module({
  controllers: [IntegracionesController],
  providers: [
    CredencialesIntegracionService,
    IntegracionRateLimitService,
    IntegracionRedisService,
    { provide: INTEGRACION_REDIS_CLIENT, useExisting: IntegracionRedisService },
  ],
  exports: [CredencialesIntegracionService, IntegracionRateLimitService],
})
export class IntegracionesModule {}
