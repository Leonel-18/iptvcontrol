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
  EstadoCuenta,
  EstadoDispositivo,
  EstadoEmpresaRevendedora,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { TeamMembersService } from '../team-members/team-members.service';
import {
  ActualizarRevendedoraDto,
  CambiarModalidadDto,
  CrearRevendedoraDto,
  ListarRevendedorasQueryDto,
} from './dto/revendedora.dto';

/**
 * Administración de Empresas Revendedoras.
 *
 * Es el tenant del sistema: cada una tiene login y panel propio, con aislamiento
 * total respecto a las demás y respecto al propio Operador Principal.
 *
 * El alta la hace siempre un `operator_admin`, y dispara la invitación del
 * `reseller_admin` correspondiente (flujo 4.7): en el MVP, cada Empresa
 * Revendedora opera con un único Team Member.
 */
@Injectable()
export class RevendedorasService {
  private readonly logger = new Logger(RevendedorasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly contexto: RequestContextService,
    private readonly teamMembers: TeamMembersService,
  ) {}

  async listar(query: ListarRevendedorasQueryDto) {
    const where: Prisma.EmpresaRevendedoraWhereInput = {
      estado: query.status,
      OR: query.q
        ? [
            { razonSocial: { contains: query.q, mode: 'insensitive' } },
            { cuit: { contains: query.q } },
            { emailContacto: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [total, empresas] = await Promise.all([
      this.prisma.db.empresaRevendedora.count({ where }),
      this.prisma.db.empresaRevendedora.findMany({
        where,
        include: {
          modalidadComercial: true,
          _count: { select: { cuentas: true, clientesFinales: true } },
        },
        orderBy: { razonSocial: 'asc' },
        skip: query.esCsv ? undefined : query.skip,
        take: query.esCsv ? undefined : query.take,
      }),
    ]);

    const data = empresas.map((empresa) => ({
      id: empresa.id,
      razon_social: empresa.razonSocial,
      cuit: empresa.cuit,
      email_contacto: empresa.emailContacto,
      telefono_contacto: empresa.telefonoContacto,
      contacto: `${empresa.nombreContacto} ${empresa.apellidoContacto}`.trim(),
      sitio_web: empresa.sitioWeb,
      estado: empresa.estado,
      modalidad_comercial: empresa.modalidadComercial
        ? {
            id: empresa.modalidadComercial.id,
            tipo: empresa.modalidadComercial.tipo,
            escala: empresa.modalidadComercial.escala,
            precio_por_cuenta: Number(empresa.modalidadComercial.precioPorCuenta),
          }
        : null,
      cantidad_cuentas: empresa._count.cuentas,
      cantidad_clientes: empresa._count.clientesFinales,
      creado_en: empresa.creadoEn,
    }));

    return PaginatedResponse.build(data, total, query.page ?? 1, query.per_page ?? 25);
  }

  /**
   * Detalle de una Empresa Revendedora.
   *
   * Para el Operador Principal incluye el resumen de Cuentas y Dispositivos, pero
   * siempre por ID: sin nombres ni datos de contacto de Clientes Finales, sin
   * credenciales de Cuenta y sin notas descriptivas (regla 4.2).
   */
  async obtener(id: string) {
    const empresa = await this.prisma.db.empresaRevendedora.findUnique({
      where: { id },
      include: {
        modalidadComercial: true,
        teamMembers: {
          select: { id: true, email: true, rol: true, estado: true, ultimoAccesoEn: true },
        },
      },
    });

    if (!empresa) {
      throw new NotFoundException('La Empresa Revendedora no existe o no está disponible.');
    }

    const [cuentas, dispositivos, clientesActivos] = await Promise.all([
      this.prisma.db.cuenta.groupBy({
        by: ['estado'],
        where: { empresaRevendedoraId: id },
        _count: { _all: true },
      }),
      this.prisma.db.dispositivo.groupBy({
        by: ['estado'],
        where: { empresaRevendedoraId: id },
        _count: { _all: true },
      }),
      this.prisma.db.clienteFinal.count({
        where: { empresaRevendedoraId: id, estado: 'activo' },
      }),
    ]);

    const contar = <T extends { _count: { _all: number } }>(
      grupos: T[],
      predicado: (grupo: T) => boolean,
    ) => grupos.filter(predicado).reduce((total, grupo) => total + grupo._count._all, 0);

    return {
      id: empresa.id,
      razon_social: empresa.razonSocial,
      cuit: empresa.cuit,
      direccion: empresa.direccion,
      nombre_contacto: empresa.nombreContacto,
      apellido_contacto: empresa.apellidoContacto,
      telefono_contacto: empresa.telefonoContacto,
      email_contacto: empresa.emailContacto,
      sitio_web: empresa.sitioWeb,
      estado: empresa.estado,
      modalidad_comercial: empresa.modalidadComercial
        ? {
            id: empresa.modalidadComercial.id,
            tipo: empresa.modalidadComercial.tipo,
            escala: empresa.modalidadComercial.escala,
            precio_por_cuenta: Number(empresa.modalidadComercial.precioPorCuenta),
            ritmo_incremento: empresa.modalidadComercial.ritmoIncremento,
            tope_cuentas_activas: empresa.modalidadComercial.topeCuentasActivas,
          }
        : null,
      team_members: empresa.teamMembers.map((miembro) => ({
        id: miembro.id,
        email: miembro.email,
        rol: miembro.rol,
        estado: miembro.estado,
        ultimo_acceso_en: miembro.ultimoAccesoEn,
      })),
      resumen: {
        cuentas_activas: contar(cuentas, (grupo) => grupo.estado === EstadoCuenta.activa),
        cuentas_cerradas: contar(cuentas, (grupo) => grupo.estado === EstadoCuenta.cerrada),
        dispositivos_activos: contar(
          dispositivos,
          (grupo) => grupo.estado === EstadoDispositivo.activo,
        ),
        dispositivos_bloqueados: contar(
          dispositivos,
          (grupo) => grupo.estado === EstadoDispositivo.bloqueado_por_suspension,
        ),
        dispositivos_disponibles: contar(
          dispositivos,
          (grupo) => grupo.estado === EstadoDispositivo.disponible,
        ),
        clientes_activos: clientesActivos,
      },
      creado_en: empresa.creadoEn,
    };
  }

  /** Perfil de la propia Empresa Revendedora, con sus precios vigentes. */
  async miPerfil() {
    const empresaRevendedoraId = this.contexto.empresaRevendedoraId;
    if (!empresaRevendedoraId) {
      throw new ForbiddenException('Este endpoint corresponde al panel de la Empresa Revendedora.');
    }
    return this.obtener(empresaRevendedoraId);
  }

  async crear(dto: CrearRevendedoraDto) {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!operadorPrincipalId) {
      throw new ForbiddenException(
        'El alta de Empresas Revendedoras la realiza el Operador Principal.',
      );
    }

    const duplicada = await this.prisma.db.empresaRevendedora.findFirst({
      where: { cuit: dto.cuit },
      select: { id: true, razonSocial: true },
    });
    if (duplicada) {
      throw new BadRequestException(
        `Ya existe una Empresa Revendedora con el CUIT ${dto.cuit} (${duplicada.razonSocial}).`,
      );
    }

    if (dto.modalidad_comercial_id) {
      await this.validarModalidad(dto.modalidad_comercial_id, operadorPrincipalId);
    }

    const empresa = await this.prisma.transaction(async (tx) => {
      const creada = await tx.empresaRevendedora.create({
        data: {
          operadorPrincipalId,
          razonSocial: dto.razon_social.trim(),
          cuit: dto.cuit,
          direccion: dto.direccion.trim(),
          nombreContacto: dto.nombre_contacto.trim(),
          apellidoContacto: dto.apellido_contacto.trim(),
          telefonoContacto: dto.telefono_contacto.trim(),
          emailContacto: dto.email_contacto.trim().toLowerCase(),
          sitioWeb: dto.sitio_web?.trim() || null,
          modalidadComercialId: dto.modalidad_comercial_id ?? null,
          estado: EstadoEmpresaRevendedora.activa,
        },
      });

      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.alta_empresa_revendedora,
        entidad: EntidadAuditada.EmpresaRevendedora,
        entidadId: creada.id,
        empresaRevendedoraId: null,
        operadorPrincipalId,
        detalle: {
          razon_social: creada.razonSocial,
          cuit: creada.cuit,
          modalidad_comercial_id: creada.modalidadComercialId,
        },
      });

      return creada;
    });

    // Invitación del reseller_admin (flujo 4.7). Si Auth0 no está configurado, el
    // alta de la Empresa Revendedora igual queda hecha: se informa el estado de
    // la invitación para que el Operador Principal la reintente después.
    const invitacion = await this.teamMembers
      .invitarResellerAdmin({
        email: empresa.emailContacto,
        nombre: `${empresa.nombreContacto} ${empresa.apellidoContacto}`.trim(),
        empresaRevendedoraId: empresa.id,
      })
      .catch((error) => {
        this.logger.error(
          `Empresa Revendedora ${empresa.id} creada, pero falló la invitación del reseller_admin: ` +
            (error as Error).message,
        );
        return { enviada: false, motivo: (error as Error).message };
      });

    return { empresa: await this.obtener(empresa.id), invitacion };
  }

  async actualizar(id: string, dto: ActualizarRevendedoraDto) {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    const esOperador = this.contexto.esOperador;

    // La Empresa Revendedora puede mantener sus datos de contacto, pero no su
    // estado (activa/suspendida): eso lo decide el Operador Principal.
    if (!esOperador) {
      if (dto.estado) {
        throw new ForbiddenException(
          'El estado de la Empresa Revendedora lo administra el Operador Principal.',
        );
      }
      if (this.contexto.empresaRevendedoraId !== id) {
        throw new ForbiddenException('No tiene permisos sobre esa Empresa Revendedora.');
      }
    }

    const anterior = await this.prisma.db.empresaRevendedora.findUnique({ where: { id } });
    if (!anterior) throw new NotFoundException('La Empresa Revendedora no existe.');

    const actualizada = await this.prisma.transaction(async (tx) => {
      const resultado = await tx.empresaRevendedora.update({
        where: { id },
        data: {
          razonSocial: dto.razon_social?.trim(),
          direccion: dto.direccion?.trim(),
          nombreContacto: dto.nombre_contacto?.trim(),
          apellidoContacto: dto.apellido_contacto?.trim(),
          telefonoContacto: dto.telefono_contacto?.trim(),
          emailContacto: dto.email_contacto?.trim().toLowerCase(),
          sitioWeb: dto.sitio_web?.trim(),
          estado: dto.estado,
        },
      });

      if (dto.estado && dto.estado !== anterior.estado) {
        await this.audit.registrarEnTx(tx, {
          accion:
            dto.estado === EstadoEmpresaRevendedora.suspendida
              ? AccionAuditoria.baja_empresa_revendedora
              : AccionAuditoria.alta_empresa_revendedora,
          entidad: EntidadAuditada.EmpresaRevendedora,
          entidadId: id,
          empresaRevendedoraId: null,
          operadorPrincipalId: operadorPrincipalId ?? anterior.operadorPrincipalId,
          detalle: { estado_anterior: anterior.estado, estado_nuevo: dto.estado },
        });
      }

      return resultado;
    });

    return this.obtener(actualizada.id);
  }

  /**
   * Cambio de modalidad comercial o escala (flujo 4.5).
   * Downgrade y upgrade, ambos exclusivos del Operador Principal.
   */
  async cambiarModalidad(id: string, dto: CambiarModalidadDto) {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!operadorPrincipalId) {
      throw new ForbiddenException(
        'El cambio de modalidad comercial es potestad exclusiva del Operador Principal.',
      );
    }

    const empresa = await this.prisma.db.empresaRevendedora.findUnique({
      where: { id },
      include: { modalidadComercial: true },
    });
    if (!empresa) throw new NotFoundException('La Empresa Revendedora no existe.');

    const nueva = await this.validarModalidad(dto.modalidad_comercial_id, operadorPrincipalId);

    await this.prisma.transaction(async (tx) => {
      await tx.empresaRevendedora.update({
        where: { id },
        data: { modalidadComercialId: nueva.id },
      });

      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.cambio_modalidad_comercial,
        entidad: EntidadAuditada.EmpresaRevendedora,
        entidadId: id,
        empresaRevendedoraId: id,
        operadorPrincipalId,
        detalle: {
          anterior: empresa.modalidadComercial
            ? {
                id: empresa.modalidadComercial.id,
                tipo: empresa.modalidadComercial.tipo,
                escala: empresa.modalidadComercial.escala,
                precio_por_cuenta: Number(empresa.modalidadComercial.precioPorCuenta),
              }
            : null,
          nueva: {
            id: nueva.id,
            tipo: nueva.tipo,
            escala: nueva.escala,
            precio_por_cuenta: Number(nueva.precioPorCuenta),
          },
          motivo: dto.motivo ?? null,
        },
      });
    });

    return this.obtener(id);
  }

  private async validarModalidad(modalidadId: string, operadorPrincipalId: string) {
    const modalidad = await this.prisma.db.modalidadComercial.findUnique({
      where: { id: modalidadId },
    });
    if (!modalidad || modalidad.operadorPrincipalId !== operadorPrincipalId) {
      throw new BadRequestException('La modalidad comercial indicada no existe.');
    }
    return modalidad;
  }
}
