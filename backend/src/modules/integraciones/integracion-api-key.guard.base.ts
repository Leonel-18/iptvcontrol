import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { CredencialesIntegracionService } from './credenciales-integracion.service';
import {
  IntegracionRateLimitExcedidoError,
  IntegracionRateLimitService,
} from './integracion-rate-limit.service';
import { PERMISO_INTEGRACION_KEY } from './integracion-permiso.decorator';
import type { PermisoIntegracion } from './permisos';
import type { ScopeIntegracion } from './permisos';

/**
 * Autenticación común de las APIs de integración.
 *
 * La key identifica a una Empresa Revendedora y se resuelve contra
 * `integracion_credencial` (o el fallback de variables de entorno). Después se
 * fija el contexto del request, se valida la Empresa/Team Member y se aplica el
 * rate limit por key.
 */
@Injectable()
export abstract class IntegracionApiKeyGuardBase implements CanActivate {
  protected abstract readonly scope: ScopeIntegracion;

  constructor(
    protected readonly credenciales: CredencialesIntegracionService,
    protected readonly rateLimit: IntegracionRateLimitService,
    protected readonly prisma: PrismaService,
    protected readonly contexto: RequestContextService,
    protected readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const recibida = request.headers['x-api-key'];
    if (typeof recibida !== 'string' || recibida.trim().length === 0) {
      throw new UnauthorizedException('Credencial de integración inválida.');
    }

    const credencial = await this.credenciales.autenticar(recibida, this.scope);

    const permisoRequerido = this.reflector.getAllAndOverride<PermisoIntegracion>(
      PERMISO_INTEGRACION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (permisoRequerido && !credencial.permisos.includes(permisoRequerido)) {
      throw new ForbiddenException(
        `La credencial no tiene el permiso requerido (${permisoRequerido}).`,
      );
    }

    try {
      await this.rateLimit.consumir(recibida);
    } catch (error) {
      if (!(error instanceof IntegracionRateLimitExcedidoError)) throw error;
      context
        .switchToHttp()
        .getResponse()
        .setHeader('Retry-After', String(error.retryAfterSeconds));
      throw new HttpException(
        {
          error: 'IntegrationRateLimited',
          message: 'Se alcanzó el límite de solicitudes de la integración.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Se fija el tenant antes de resolver el operador: la política RLS de
    // `empresa_revendedora` habilita la lectura con el tenant ya seteado.
    this.contexto.set({
      esOperador: false,
      empresaRevendedoraId: credencial.empresaRevendedoraId,
      teamMemberId: credencial.teamMemberId,
    });

    const empresa = await this.prisma.db.empresaRevendedora.findUnique({
      where: { id: credencial.empresaRevendedoraId },
      select: { operadorPrincipalId: true, estado: true },
    });

    if (!empresa) {
      throw new ForbiddenException(
        'La Empresa Revendedora asociada a la credencial no existe en IPTVControl.',
      );
    }
    if (empresa.estado === 'suspendida') {
      throw new ForbiddenException(
        'La Empresa Revendedora asociada a la credencial está suspendida.',
      );
    }

    this.contexto.set({ operadorPrincipalId: empresa.operadorPrincipalId });

    if (credencial.teamMemberId) {
      const teamMember = await this.prisma.db.teamMember.findUnique({
        where: { id: credencial.teamMemberId },
        select: { empresaRevendedoraId: true },
      });
      if (!teamMember || teamMember.empresaRevendedoraId !== credencial.empresaRevendedoraId) {
        throw new ForbiddenException(
          'El Team Member configurado en la credencial no pertenece a la Empresa Revendedora.',
        );
      }
    }

    if (credencial.credencialId) {
      void this.credenciales.marcarUso(credencial.credencialId);
    }

    return true;
  }
}
