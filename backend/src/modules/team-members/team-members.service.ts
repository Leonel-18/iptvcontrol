import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AccionAuditoria,
  EntidadAuditada,
  EstadoTeamMember,
  Prisma,
  RolTeamMember,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { Auth0ManagementService } from '../../common/auth/auth0-management.service';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { CrearTeamMemberDto, ListarTeamMembersQueryDto } from './dto/team-member.dto';

export interface ResultadoInvitacion {
  enviada: boolean;
  team_member_id?: string;
  /** URL del ticket de Auth0. El envío del email queda a cargo del backend. */
  url_invitacion?: string;
  expira_en_segundos?: number;
  motivo?: string;
}

/**
 * =============================================================================
 * Team Members — logins con permisos sobre los paneles
 * =============================================================================
 * "Team Member" en lugar de "usuario" para eliminar la ambigüedad de esa palabra:
 * en IPTVControl el Cliente Final NO tiene acceso propio al sistema, así que
 * llamar "usuario" a las dos cosas es exactamente el tipo de confusión que
 * genera bugs de permisos en multi-tenant
 * (docs/IPTVControl_URL_Routing_Convention.md, sección 4.3).
 *
 * Provisioning (flujo 4.7): se crea el usuario en Auth0 con una contraseña
 * descartable y se genera un Password Change Ticket, un link de un solo uso donde
 * la persona elige su propia contraseña. Ni IPTVControl ni el Operador Principal
 * la conocen nunca.
 *
 * Excepción: el primer `operator_admin` no se crea por acá — se provisiona con el
 * seed `npm run seed:root`, porque en ese momento no existe nadie con permisos
 * para crearlo (flujo 4.6).
 * =============================================================================
 */
@Injectable()
export class TeamMembersService {
  private readonly logger = new Logger(TeamMembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly contexto: RequestContextService,
    private readonly auth0: Auth0ManagementService,
  ) {}

  async listar(query: ListarTeamMembersQueryDto) {
    const where: Prisma.TeamMemberWhereInput = {
      rol: query.role,
      estado: query.status,
      empresaRevendedoraId: query.reseller_id,
      OR: query.q
        ? [
            { email: { contains: query.q, mode: 'insensitive' } },
            { nombre: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [total, miembros] = await Promise.all([
      this.prisma.db.teamMember.count({ where }),
      this.prisma.db.teamMember.findMany({
        where,
        include: { empresaRevendedora: { select: { id: true, razonSocial: true } } },
        orderBy: { creadoEn: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
    ]);

    const data = miembros.map((miembro) => ({
      id: miembro.id,
      email: miembro.email,
      nombre: miembro.nombre,
      rol: miembro.rol,
      estado: miembro.estado,
      empresa_revendedora: miembro.empresaRevendedora
        ? {
            id: miembro.empresaRevendedora.id,
            razon_social: miembro.empresaRevendedora.razonSocial,
          }
        : null,
      es_del_operador: miembro.operadorPrincipalId !== null,
      ultimo_acceso_en: miembro.ultimoAccesoEn,
      creado_en: miembro.creadoEn,
    }));

    return PaginatedResponse.build(data, total, query.page ?? 1, query.per_page ?? 25);
  }

  /** Datos del Team Member autenticado (para el header del panel). */
  async yo() {
    const teamMemberId = this.contexto.teamMemberId;
    if (!teamMemberId) throw new ForbiddenException('Sesión sin Team Member asociado.');

    const miembro = await this.prisma.sinContexto.teamMember.findUniqueOrThrow({
      where: { id: teamMemberId },
      include: {
        empresaRevendedora: { select: { id: true, razonSocial: true, estado: true } },
        operadorPrincipal: { select: { id: true, nombre: true } },
      },
    });

    return {
      id: miembro.id,
      email: miembro.email,
      nombre: miembro.nombre,
      rol: miembro.rol,
      estado: miembro.estado,
      es_operador: miembro.operadorPrincipalId !== null,
      operador_principal: miembro.operadorPrincipal
        ? { id: miembro.operadorPrincipal.id, nombre: miembro.operadorPrincipal.nombre }
        : null,
      empresa_revendedora: miembro.empresaRevendedora
        ? {
            id: miembro.empresaRevendedora.id,
            razon_social: miembro.empresaRevendedora.razonSocial,
            estado: miembro.empresaRevendedora.estado,
          }
        : null,
    };
  }

  /**
   * Invitación del `reseller_admin` de una Empresa Revendedora.
   * En el MVP es el único rol posible del lado Empresa Revendedora: un solo
   * login por empresa, sin sub-roles internos.
   */
  async invitarResellerAdmin(params: {
    email: string;
    nombre?: string;
    empresaRevendedoraId: string;
  }): Promise<ResultadoInvitacion> {
    return this.invitar({
      email: params.email,
      nombre: params.nombre,
      rol: RolTeamMember.reseller_admin,
      empresaRevendedoraId: params.empresaRevendedoraId,
    });
  }

  /** Alta de Team Member desde el panel (`/team-members`). */
  async crear(dto: CrearTeamMemberDto): Promise<ResultadoInvitacion> {
    const esOperador = this.contexto.esOperador;
    const rolesDeOperador: RolTeamMember[] = [
      RolTeamMember.operator_admin,
      RolTeamMember.operator_staff,
    ];

    if (rolesDeOperador.includes(dto.rol)) {
      if (!esOperador) {
        throw new ForbiddenException(
          'Sólo el Operador Principal puede dar de alta Team Members del Operador.',
        );
      }
      return this.invitar({
        email: dto.email,
        nombre: dto.nombre,
        rol: dto.rol,
        operadorPrincipalId: this.contexto.operadorPrincipalId!,
      });
    }

    // Roles de Empresa Revendedora: el Operador Principal indica cuál; una
    // Empresa Revendedora sólo puede sumar gente a sí misma.
    const empresaRevendedoraId = esOperador
      ? dto.empresa_revendedora_id
      : this.contexto.empresaRevendedoraId;

    if (!empresaRevendedoraId) {
      throw new BadRequestException(
        'Falta indicar la Empresa Revendedora a la que pertenece el Team Member.',
      );
    }

    return this.invitar({
      email: dto.email,
      nombre: dto.nombre,
      rol: dto.rol,
      empresaRevendedoraId,
    });
  }

  /**
   * Reenvío de invitación: genera un ticket nuevo para el mismo usuario de Auth0,
   * sin recrearlo. Cubre el caso de link vencido o email perdido.
   */
  async reenviarInvitacion(id: string): Promise<ResultadoInvitacion> {
    const miembro = await this.prisma.db.teamMember.findUnique({ where: { id } });
    if (!miembro) throw new NotFoundException('El Team Member no existe.');

    if (!miembro.auth0UserId) {
      throw new BadRequestException(
        'El Team Member no tiene usuario en Auth0. Vuelva a darlo de alta para generar la invitación.',
      );
    }

    if (!this.auth0.habilitado) {
      return {
        enviada: false,
        team_member_id: miembro.id,
        motivo: 'La integración con Auth0 no está configurada en el servidor.',
      };
    }

    const invitacion = await this.auth0.reenviarInvitacion(miembro.auth0UserId);

    await this.audit.registrar({
      accion: AccionAuditoria.reenvio_invitacion_team_member,
      entidad: EntidadAuditada.TeamMember,
      entidadId: miembro.id,
      empresaRevendedoraId: miembro.empresaRevendedoraId,
      detalle: { email: miembro.email },
    });

    return {
      enviada: true,
      team_member_id: miembro.id,
      url_invitacion: invitacion.urlInvitacion,
      expira_en_segundos: invitacion.expiraEnSegundos,
    };
  }

  /** Baja de acceso: se desactiva localmente y se bloquea el login en Auth0. */
  async desactivar(id: string) {
    const miembro = await this.prisma.db.teamMember.findUnique({ where: { id } });
    if (!miembro) throw new NotFoundException('El Team Member no existe.');

    if (miembro.id === this.contexto.teamMemberId) {
      throw new BadRequestException('No puede darse de baja su propio acceso.');
    }

    // Salvaguarda de arranque en frío al revés: si se desactivara al último
    // operator_admin, nadie podría volver a administrar el sistema.
    if (miembro.rol === RolTeamMember.operator_admin) {
      const activos = await this.prisma.db.teamMember.count({
        where: {
          operadorPrincipalId: miembro.operadorPrincipalId,
          rol: RolTeamMember.operator_admin,
          estado: { in: [EstadoTeamMember.activo, EstadoTeamMember.invitado] },
        },
      });
      if (activos <= 1) {
        throw new BadRequestException(
          'No se puede dar de baja al último administrador del Operador Principal.',
        );
      }
    }

    await this.prisma.transaction(async (tx) => {
      await tx.teamMember.update({
        where: { id },
        data: { estado: EstadoTeamMember.inactivo },
      });
      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.baja_team_member,
        entidad: EntidadAuditada.TeamMember,
        entidadId: id,
        empresaRevendedoraId: miembro.empresaRevendedoraId,
        detalle: { email: miembro.email, rol: miembro.rol },
      });
    });

    if (miembro.auth0UserId && this.auth0.habilitado) {
      await this.auth0
        .bloquearUsuario(miembro.auth0UserId)
        .catch((error) =>
          this.logger.error(
            `Team Member ${id} desactivado localmente, pero no se pudo bloquear en Auth0: ` +
              (error as Error).message,
          ),
        );
    }

    return { id, estado: EstadoTeamMember.inactivo };
  }

  // ---------------------------------------------------------------------------
  // Interno
  // ---------------------------------------------------------------------------

  private async invitar(params: {
    email: string;
    nombre?: string;
    rol: RolTeamMember;
    empresaRevendedoraId?: string;
    operadorPrincipalId?: string;
  }): Promise<ResultadoInvitacion> {
    const email = params.email.trim().toLowerCase();

    const existente = await this.prisma.sinContexto.teamMember.findUnique({ where: { email } });
    if (existente) {
      throw new BadRequestException(
        `Ya existe un Team Member con el email ${email}. Use "Reenviar invitación" si hace falta.`,
      );
    }

    // Si Auth0 no está configurado (entorno de desarrollo), el Team Member queda
    // registrado como invitado sin `auth0_user_id`: el alta de negocio no se
    // bloquea por una dependencia de infraestructura.
    if (!this.auth0.habilitado) {
      const miembro = await this.registrar({ ...params, email, auth0UserId: null });
      this.logger.warn(
        `Team Member ${email} registrado sin usuario de Auth0: falta configurar la Management API.`,
      );
      return {
        enviada: false,
        team_member_id: miembro.id,
        motivo:
          'La integración con Auth0 no está configurada en el servidor: el acceso queda pendiente ' +
          'de invitación.',
      };
    }

    const invitacion = await this.auth0.crearInvitacion(email, {
      rol: params.rol,
      empresa_revendedora_id: params.empresaRevendedoraId ?? null,
      operador_principal_id: params.operadorPrincipalId ?? null,
    });

    const miembro = await this.registrar({
      ...params,
      email,
      auth0UserId: invitacion.auth0UserId,
    });

    return {
      enviada: true,
      team_member_id: miembro.id,
      url_invitacion: invitacion.urlInvitacion,
      expira_en_segundos: invitacion.expiraEnSegundos,
    };
  }

  private async registrar(params: {
    email: string;
    nombre?: string;
    rol: RolTeamMember;
    empresaRevendedoraId?: string;
    operadorPrincipalId?: string;
    auth0UserId: string | null;
  }) {
    return this.prisma.transaction(async (tx) => {
      const miembro = await tx.teamMember.create({
        data: {
          email: params.email,
          nombre: params.nombre ?? null,
          rol: params.rol,
          empresaRevendedoraId: params.empresaRevendedoraId ?? null,
          operadorPrincipalId: params.operadorPrincipalId ?? null,
          auth0UserId: params.auth0UserId,
          estado: EstadoTeamMember.invitado,
        },
      });

      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.alta_team_member,
        entidad: EntidadAuditada.TeamMember,
        entidadId: miembro.id,
        empresaRevendedoraId: params.empresaRevendedoraId ?? null,
        detalle: { email: miembro.email, rol: miembro.rol },
      });

      return miembro;
    });
  }
}
