import {
  BadRequestException,
  ConflictException,
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
import { ProveedorService } from '../../proveedor/proveedor.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { InventarioProveedorService } from '../cuentas/inventario-proveedor.service';
import { normalizarServicios } from '../../proveedor/servicios.util';
import { ImportarCuentasExternasDto } from './dto/cuenta-externa.dto';
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
    private readonly proveedor: ProveedorService,
    private readonly crypto: CryptoService,
    private readonly inventario: InventarioProveedorService,
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

  /**
   * Compara el inventario completo del Proveedor con las Cuentas locales del
   * Operador. Sólo se usan identificadores técnicos para evitar falsos matches
   * por nombres o correos compartidos.
   */
  async listarCuentasExternas() {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!operadorPrincipalId) {
      throw new ForbiddenException('Este endpoint corresponde al Operador Principal.');
    }

    const [cuentasProveedor, cuentasLocales] = await Promise.all([
      this.proveedor.listarCuentas(operadorPrincipalId),
      this.prisma.db.cuenta.findMany({
        where: { empresaRevendedora: { operadorPrincipalId } },
        select: { proveedorCuentaId: true, dniAltaSensa: true },
      }),
    ]);

    const idsProveedorLocales = new Set(
      cuentasLocales
        .map((cuenta) => cuenta.proveedorCuentaId?.trim())
        .filter((valor): valor is string => Boolean(valor)),
    );
    const dnisLocales = new Set(cuentasLocales.map((cuenta) => cuenta.dniAltaSensa.trim()));
    const externas = cuentasProveedor.filter(
      (cuenta) =>
        !idsProveedorLocales.has(cuenta.proveedorCuentaId.trim()) &&
        !dnisLocales.has(cuenta.dni.trim()),
    );

    return {
      resumen: {
        cuentas_proveedor: cuentasProveedor.length,
        cuentas_iptvcontrol: cuentasLocales.length,
        cuentas_externas: externas.length,
      },
      cuentas: externas.map((cuenta) => ({
        proveedor_cuenta_id: cuenta.proveedorCuentaId,
        dni: cuenta.dni,
        nombre: cuenta.nombre,
        apellido: cuenta.apellido,
        email: cuenta.email,
        ciudad: cuenta.ciudad,
        referencia_externa: cuenta.referenciaExterna ?? null,
        fecha_alta: cuenta.fechaAlta ?? null,
        estado: cuenta.activa ? 'activa' : 'inactiva',
      })),
    };
  }

  async importarCuentasExternas(dto: ImportarCuentasExternasDto) {
    const operadorPrincipalId = this.requerirOperador();
    const empresa = await this.prisma.db.empresaRevendedora.findFirst({
      where: {
        id: dto.empresa_revendedora_id,
        operadorPrincipalId,
        estado: EstadoEmpresaRevendedora.activa,
      },
      select: { id: true },
    });
    if (!empresa) {
      throw new BadRequestException(
        'La Empresa Revendedora no existe, está suspendida o no pertenece al Operador.',
      );
    }

    const [cuentasProveedor, { configuracion }] = await Promise.all([
      this.proveedor.listarCuentas(operadorPrincipalId),
      this.proveedor.resolver(operadorPrincipalId),
    ]);
    const porId = new Map(
      cuentasProveedor.flatMap((cuenta) => [
        [cuenta.proveedorCuentaId.trim(), cuenta] as const,
        [cuenta.dni.trim(), cuenta] as const,
      ]),
    );
    const resultados: Array<{
      proveedor_cuenta_id: string;
      estado: 'importada' | 'ya_importada' | 'fallida';
      cuenta_id?: string;
      mensaje?: string;
    }> = [];

    for (const idSolicitado of dto.proveedor_cuenta_ids) {
      const proveedorCuentaId = idSolicitado.trim();
      const remota = porId.get(proveedorCuentaId);
      if (!remota) {
        resultados.push({
          proveedor_cuenta_id: proveedorCuentaId,
          estado: 'fallida',
          mensaje: 'La Cuenta ya no existe en el Proveedor.',
        });
        continue;
      }
      if (!remota.dni.trim() || !remota.email.trim() || !remota.pin) {
        resultados.push({
          proveedor_cuenta_id: proveedorCuentaId,
          estado: 'fallida',
          mensaje: 'El Proveedor no informó DNI, correo o PIN suficientes para importarla.',
        });
        continue;
      }
      const pin = remota.pin;

      try {
        const resultado = await this.prisma.transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${operadorPrincipalId}:${proveedorCuentaId}`}))`;
          const existente = await tx.cuenta.findFirst({
            where: {
              empresaRevendedora: { operadorPrincipalId },
              OR: [{ proveedorCuentaId: remota.proveedorCuentaId }, { dniAltaSensa: remota.dni }],
            },
            select: { id: true },
          });
          if (existente) return { estado: 'ya_importada' as const, id: existente.id };

          const creada = await tx.cuenta.create({
            data: {
              empresaRevendedoraId: empresa.id,
              proveedorId: configuracion.proveedorId,
              proveedorCuentaId: remota.proveedorCuentaId,
              dniAltaSensa: remota.dni.trim(),
              usuario: remota.proveedorCuentaId,
              passwordCifrado: null,
              pinCifrado: this.crypto.encrypt(pin),
              emailContacto: remota.email.trim().toLowerCase(),
              esExclusiva: true,
              servicios: normalizarServicios((remota.servicios || '1').split('|')),
              limiteDispositivos: 3,
              dispositivosFijosHabilitados: Math.max(0, Math.min(3, remota.dispositivosFijos)),
              dispositivosMovilesHabilitados: Math.max(0, Math.min(3, remota.dispositivosMoviles)),
              estado: remota.activa ? EstadoCuenta.activa : EstadoCuenta.cerrada,
            },
          });
          await this.audit.registrarEnTx(tx, {
            accion: AccionAuditoria.alta_cuenta,
            entidad: EntidadAuditada.Cuenta,
            entidadId: creada.id,
            empresaRevendedoraId: empresa.id,
            operadorPrincipalId,
            detalle: {
              origen: 'importacion_proveedor',
              proveedor_cuenta_id: remota.proveedorCuentaId,
              es_exclusiva: true,
              password_pendiente: true,
            },
          });
          return { estado: 'importada' as const, id: creada.id };
        });

        let mensaje: string | undefined;
        if (resultado.estado === 'importada' && remota.activa) {
          try {
            await this.inventario.sincronizar(resultado.id);
          } catch {
            mensaje =
              'La Cuenta se importó, pero el inventario de Dispositivos quedó pendiente de consulta.';
          }
        }
        resultados.push({
          proveedor_cuenta_id: proveedorCuentaId,
          estado: resultado.estado,
          cuenta_id: resultado.id,
          mensaje,
        });
      } catch (error) {
        const duplicada =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        resultados.push({
          proveedor_cuenta_id: proveedorCuentaId,
          estado: duplicada ? 'ya_importada' : 'fallida',
          mensaje: duplicada
            ? 'La Cuenta fue importada por otro proceso.'
            : error instanceof Error
              ? error.message
              : 'No se pudo importar la Cuenta.',
        });
      }
    }

    return {
      resumen: {
        solicitadas: resultados.length,
        importadas: resultados.filter((item) => item.estado === 'importada').length,
        ya_importadas: resultados.filter((item) => item.estado === 'ya_importada').length,
        fallidas: resultados.filter((item) => item.estado === 'fallida').length,
      },
      resultados,
    };
  }

  async cerrarCuentaExterna(proveedorCuentaIdSinNormalizar: string) {
    const operadorPrincipalId = this.requerirOperador();
    const proveedorCuentaId = proveedorCuentaIdSinNormalizar.trim();
    if (!proveedorCuentaId || proveedorCuentaId.length > 60) {
      throw new BadRequestException('El identificador de la Cuenta no es válido.');
    }

    return this.prisma.transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${operadorPrincipalId}:${proveedorCuentaId}`}))`;
        const local = await tx.cuenta.findFirst({
          where: {
            empresaRevendedora: { operadorPrincipalId },
            OR: [{ proveedorCuentaId }, { dniAltaSensa: proveedorCuentaId }],
          },
          select: { id: true },
        });
        if (local) {
          throw new ConflictException(
            'La Cuenta ya está registrada en IPTVControl y debe administrarse desde su Empresa Revendedora.',
          );
        }

        const remota = await this.proveedor.consultarCuenta(operadorPrincipalId, proveedorCuentaId);
        if (!remota) return { proveedor_cuenta_id: proveedorCuentaId, estado: 'ya_no_existe' };

        const dispositivos = await this.proveedor.listarDispositivos(
          operadorPrincipalId,
          proveedorCuentaId,
        );
        if (dispositivos.length > 0) {
          throw new BadRequestException(
            `No se puede eliminar: SENSA informa ${dispositivos.length} Dispositivo(s) en esta Cuenta.`,
          );
        }

        await this.proveedor.cerrarCuenta(operadorPrincipalId, proveedorCuentaId);
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.cierre_cuenta,
          entidad: EntidadAuditada.Cuenta,
          entidadId: proveedorCuentaId,
          operadorPrincipalId,
          detalle: { origen: 'cuenta_externa', proveedor_cuenta_id: proveedorCuentaId },
        });
        return { proveedor_cuenta_id: proveedorCuentaId, estado: 'eliminada' };
      },
      { timeoutMs: 60_000 },
    );
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

  private requerirOperador(): string {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!operadorPrincipalId) {
      throw new ForbiddenException('Este endpoint corresponde al Operador Principal.');
    }
    return operadorPrincipalId;
  }
}
