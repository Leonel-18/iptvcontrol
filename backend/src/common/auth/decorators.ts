import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { RolTeamMember } from '@prisma/client';
import { RequestContext } from '../context/request-context.service';

export const PUBLIC_KEY = 'iptvcontrol:public';
export const ROLES_KEY = 'iptvcontrol:roles';

/** Marca un endpoint como accesible sin token (health check, por ejemplo). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/**
 * Restringe un endpoint a ciertos roles de Team Member.
 *
 * En el MVP los roles reales son `operator_admin` y `reseller_admin`; los
 * `*_staff` están declarados en el glosario pero reservados a futuro. Igual se
 * escriben las listas completas donde corresponde, para que sumar sub-roles
 * después no implique revisar todos los controllers.
 */
export const Roles = (...roles: RolTeamMember[]) => SetMetadata(ROLES_KEY, roles);

/** Atajo: sólo Team Members del Operador Principal. */
export const SoloOperador = () => Roles(RolTeamMember.operator_admin, RolTeamMember.operator_staff);

/** Atajo: sólo Team Members de una Empresa Revendedora. */
export const SoloRevendedor = () =>
  Roles(RolTeamMember.reseller_admin, RolTeamMember.reseller_staff);

/** Inyecta el contexto del request (Team Member, tenant, rol) en el handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.contextoIptv as RequestContext;
  },
);
