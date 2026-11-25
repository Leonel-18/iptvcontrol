import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { CredencialesIntegracionService } from '../integraciones/credenciales-integracion.service';
import { IntegracionRateLimitService } from '../integraciones/integracion-rate-limit.service';
import { IntegracionApiKeyGuardBase } from '../integraciones/integracion-api-key.guard.base';

/**
 * Autenticación del bot de WhatsApp.
 *
 * La key identifica a la Empresa Revendedora; ya no hay una empresa fija en el
 * `.env`. El fallback a `WSP_BOT_*` se mantiene durante la transición.
 */
@Injectable()
export class BotApiKeyGuard extends IntegracionApiKeyGuardBase {
  protected readonly scope = 'whatsapp_bot' as const;

  constructor(
    credenciales: CredencialesIntegracionService,
    rateLimit: IntegracionRateLimitService,
    prisma: PrismaService,
    contexto: RequestContextService,
    reflector: Reflector,
  ) {
    super(credenciales, rateLimit, prisma, contexto, reflector);
  }
}
