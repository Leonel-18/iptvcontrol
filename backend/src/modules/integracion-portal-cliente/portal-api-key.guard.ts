import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { CredencialesIntegracionService } from '../integraciones/credenciales-integracion.service';
import { IntegracionRateLimitService } from '../integraciones/integracion-rate-limit.service';
import { IntegracionApiKeyGuardBase } from '../integraciones/integracion-api-key.guard.base';

/**
 * Autenticación del Portal de Cliente externo.
 *
 * Comparte el mismo resolvedor de credenciales que el bot: una key puede
 * habilitar el portal, el bot o ambos (según `scopes`). El fallback a
 * `PORTAL_CLIENTE_*` se mantiene durante la transición.
 */
@Injectable()
export class PortalApiKeyGuard extends IntegracionApiKeyGuardBase {
  protected readonly scope = 'portal_cliente' as const;

  constructor(
    credenciales: CredencialesIntegracionService,
    rateLimit: IntegracionRateLimitService,
    prisma: PrismaService,
    contexto: RequestContextService,
  ) {
    super(credenciales, rateLimit, prisma, contexto);
  }
}
