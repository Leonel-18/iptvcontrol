import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EstadoTeamMember, RolTeamMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContextService } from '../context/request-context.service';
import { PUBLIC_KEY, ROLES_KEY } from './decorators';

/**
 * Resuelve el Team Member dueño del token y fija el contexto multi-tenant.
 *
 * Es el corazón del aislamiento: acá se decide, una sola vez por request, a qué
 * tenant pertenece quien está llamando. De ahí en adelante ni los controllers ni
 * los servicios "eligen" tenant — lo heredan del contexto y de las políticas de
 * Row-Level Security. Ese es el motivo por el que la misma URL (`/customers`)
 * sirve para los dos paneles sin exponer datos cruzados
 * (docs/IPTVControl_URL_Routing_Convention.md, sección 1.3).
 */
@Injectable()
export class TeamMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublico) return true;

    const request = context.switchToHttp().getRequest();
    const auth0UserId: string | undefined = request.user?.sub;
    if (!auth0UserId) {
      throw new UnauthorizedException('Token sin identificador de usuario.');
    }

    // Se busca con el cliente sin contexto: en este punto todavía no sabemos a
    // qué tenant pertenece el usuario. La política de RLS de `team_member`
    // habilita exactamente este caso (contexto vacío).
    const teamMember = await this.prisma.sinContexto.teamMember.findUnique({
      where: { auth0UserId },
      select: {
        id: true,
        email: true,
        rol: true,
        estado: true,
        empresaRevendedoraId: true,
        operadorPrincipalId: true,
        empresaRevendedora: { select: { operadorPrincipalId: true, estado: true } },
      },
    });

    if (!teamMember) {
      throw new ForbiddenException(
        'El usuario está autenticado pero no tiene acceso habilitado en IPTVControl.',
      );
    }

    if (teamMember.estado === EstadoTeamMember.inactivo) {
      throw new ForbiddenException('El acceso de este usuario está dado de baja.');
    }

    const esOperador =
      teamMember.rol === RolTeamMember.operator_admin ||
      teamMember.rol === RolTeamMember.operator_staff;

    // Una Empresa Revendedora suspendida no opera; su Team Member no entra.
    if (!esOperador && teamMember.empresaRevendedora?.estado === 'suspendida') {
      throw new ForbiddenException(
        'La Empresa Revendedora está suspendida. Comuníquese con el operador.',
      );
    }

    const operadorPrincipalId = esOperador
      ? teamMember.operadorPrincipalId
      : (teamMember.empresaRevendedora?.operadorPrincipalId ?? null);

    this.contexto.set({
      teamMemberId: teamMember.id,
      auth0UserId,
      email: teamMember.email,
      rol: teamMember.rol,
      empresaRevendedoraId: esOperador ? null : teamMember.empresaRevendedoraId,
      operadorPrincipalId,
      esOperador,
    });

    // Se expone también en el request para el decorador @CurrentUser().
    request.contextoIptv = this.contexto.get();

    // Primer acceso: un Team Member invitado pasa a activo al usar el sistema.
    if (teamMember.estado === EstadoTeamMember.invitado) {
      await this.prisma.sinContexto.teamMember.update({
        where: { id: teamMember.id },
        data: { estado: EstadoTeamMember.activo, ultimoAccesoEn: new Date() },
      });
    }

    const rolesRequeridos = this.reflector.getAllAndOverride<RolTeamMember[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (rolesRequeridos?.length && !rolesRequeridos.includes(teamMember.rol)) {
      throw new ForbiddenException('No tiene permisos para realizar esta operación.');
    }

    return true;
  }
}
