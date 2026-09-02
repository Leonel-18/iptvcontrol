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
  ClienteFinal,
  EntidadAuditada,
  EstadoClienteFinal,
  EstadoCuenta,
  EstadoDispositivo,
  EstadoSolicitudVinculacion,
  Prisma,
  TipoAltaClienteFinal,
  MotivoFinVentanaCuriosidad,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { DispositivosService } from '../dispositivos/dispositivos.service';
import { IdentificadoresService } from '../cuentas/identificadores.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { normalizarServicios, validarServiciosContratados } from '../../proveedor/servicios.util';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto, ListarClientesQueryDto } from './dto/listar-clientes.query';
import { calcularCapacidad, ESTADOS_QUE_OCUPAN } from '../cuentas/capacidad.util';
import { nombresDeServicios } from '../cuentas/cuentas.mapper';

/** Coincidencia de `id_gestion_externo` dentro de la misma Empresa Revendedora. */
export interface CoincidenciaGestionExterna {
  id: string;
  numero_cliente: number;
  nombre: string;
  estado: EstadoClienteFinal;
  dispositivos: number;
}

/**
 * =============================================================================
 * Ciclo de vida del Cliente Final
 * =============================================================================
 * Implementa las reglas de la sección 3 de docs/03_Reglas_de_Negocio.md:
 *
 *   alta ──> activo ──┬──> suspendido ──> baja definitiva ──> (dispositivo libre)
 *                     └──> baja definitiva ──> (dispositivo libre)
 *
 * La diferencia clave entre suspensión y baja está en qué pasa con el
 * Dispositivo: en la suspensión queda RESERVADO para el titular
 * (`bloqueado_por_suspension`, no reasignable a nadie); en la baja definitiva
 * queda LIBRE (`disponible`) y puede tomarlo un Cliente Final nuevo. La única vía
 * para liberar un Dispositivo bloqueado es la transición explícita de suspendido
 * a baja definitiva — no es un pendiente de roadmap, es una regla permanente.
 * =============================================================================
 */
@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
    private readonly contexto: RequestContextService,
    private readonly dispositivos: DispositivosService,
    private readonly identificadores: IdentificadoresService,
    private readonly proveedor: ProveedorService,
  ) {}

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  async listar(query: ListarClientesQueryDto) {
    const esOperador = this.contexto.esOperador;

    const where: Prisma.ClienteFinalWhereInput = {
      empresaRevendedoraId: query.reseller_id,
      estado: query.status,
      idGestionExterno: query.external_id,
      AND: query.account_id
        ? [
            {
              OR: [
                { dispositivos: { some: { cuentaId: query.account_id } } },
                { cuentasExclusivas: { some: { id: query.account_id } } },
              ],
            },
          ]
        : undefined,
      // La búsqueda libre del Operador Principal NO puede tocar nombre, teléfono,
      // correo ni dirección: aunque esos campos no se serialicen, poder filtrar
      // por ellos permitiría confirmar su contenido por prueba y error, y sería
      // la misma fuga por otra vía (regla de negocio 4.2).
      OR: query.q
        ? esOperador
          ? [{ idGestionExterno: { contains: query.q, mode: 'insensitive' } }]
          : [
              { nombre: { contains: query.q, mode: 'insensitive' } },
              { apellido: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
              { telefono: { contains: query.q } },
              { idGestionExterno: { contains: query.q, mode: 'insensitive' } },
            ]
        : undefined,
    };

    const esCsv = query.esCsv;
    const [total, clientes] = await Promise.all([
      this.prisma.db.clienteFinal.count({ where }),
      this.prisma.db.clienteFinal.findMany({
        where,
        include: {
          dispositivos: {
            select: { id: true, tipo: true, estado: true, cuentaId: true },
          },
          cuentasExclusivas: { select: { id: true } },
        },
        orderBy: { numeroCliente: 'desc' },
        skip: esCsv ? undefined : query.skip,
        take: esCsv ? undefined : query.take,
      }),
    ]);

    // Para el Operador Principal se serializa la versión por ID, igual que en el
    // detalle: nombre y datos de contacto no llegan al frontend (regla 4.2).
    const data = clientes.map((cliente) =>
      esOperador ? this.mapClienteParaOperador(cliente) : this.mapCliente(cliente),
    );
    return PaginatedResponse.build(data, total, query.page ?? 1, query.per_page ?? 25);
  }

  /**
   * Vista por Cliente (reglas de negocio, sección 8): credenciales de la Cuenta a
   * la que pertenece, parametrización de contenido, sus Dispositivos y el enlace
   * a la vista completa de la Cuenta.
   */
  async obtener(id: string) {
    const cliente = await this.prisma.db.clienteFinal.findUnique({
      where: { id },
      include: {
        cuentasExclusivas: true,
        dispositivos: {
          include: {
            cuenta: true,
            // Para avisar en el panel que hay una ventana de vinculación en
            // curso (hasta 10 minutos, sondeo cada 30 s) en vez de dejar que
            // la Empresa Revendedora se entere sólo por un toast que ya pasó.
            solicitudesVinculacion: {
              where: {
                estado: {
                  in: [
                    EstadoSolicitudVinculacion.pendiente,
                    EstadoSolicitudVinculacion.observando,
                    EstadoSolicitudVinculacion.ambiguo,
                  ],
                },
              },
              select: { expiraEn: true, proximoSondeoEn: true },
              orderBy: { abiertaEn: 'desc' },
              take: 1,
            },
          },
          orderBy: [{ tipo: 'asc' }, { creadoEn: 'asc' }],
        },
      },
    });

    if (!cliente) throw new NotFoundException('El cliente no existe o no está disponible.');

    const esOperador = this.contexto.esOperador;

    // Para el Operador Principal se devuelve la versión por ID: sin nombre, sin
    // datos de contacto y sin nota descriptiva (regla 4.2).
    if (esOperador) {
      return {
        id: cliente.id,
        numero_cliente: cliente.numeroCliente,
        empresa_revendedora_id: cliente.empresaRevendedoraId,
        estado: cliente.estado,
        tipo_alta: cliente.tipoAlta,
        creado_en: cliente.creadoEn,
        dispositivos: cliente.dispositivos.map((dispositivo) => ({
          id: dispositivo.id,
          cuenta_id: dispositivo.cuentaId,
          proveedor_device_id: dispositivo.proveedorDeviceId,
          tipo: dispositivo.tipo,
          estado: dispositivo.estado,
          ventana_vinculacion: dispositivo.solicitudesVinculacion[0]
            ? { expira_en: dispositivo.solicitudesVinculacion[0].expiraEn }
            : null,
        })),
      };
    }

    const cuentaPrincipal = cliente.dispositivos[0]?.cuenta ?? cliente.cuentasExclusivas[0] ?? null;
    const capacidad = cuentaPrincipal
      ? calcularCapacidad({
          ...cuentaPrincipal,
          dispositivos: await this.prisma.db.dispositivo.findMany({
            where: { cuentaId: cuentaPrincipal.id },
            select: { tipo: true, estado: true, clienteFinalId: true },
          }),
          ventasCompartidas: await this.prisma.db.ventaCompartida.findMany({
            where: { cuentaId: cuentaPrincipal.id },
            select: { cuposPorCategoria: true },
          }),
        })
      : null;

    return {
      ...this.mapCliente(cliente),
      // Credenciales de la Cuenta del cliente: es lo que la Empresa Revendedora
      // le pasa al Cliente Final para que use el servicio.
      cuenta: cuentaPrincipal
        ? {
            id: cuentaPrincipal.id,
            proveedor_cuenta_id: cuentaPrincipal.proveedorCuentaId,
            usuario: cuentaPrincipal.usuario,
            password: this.crypto.tryDecrypt(cuentaPrincipal.passwordCifrado),
            pin: this.crypto.tryDecrypt(cuentaPrincipal.pinCifrado),
            email_contacto: cuentaPrincipal.emailContacto,
            servicios: cuentaPrincipal.servicios,
            servicios_nombres: nombresDeServicios(cuentaPrincipal.servicios),
            es_exclusiva: cuentaPrincipal.esExclusiva,
            capacidad: capacidad
              ? capacidad.esExclusiva
                ? `${capacidad.ocupados} de ${capacidad.limite}`
                : `${capacidad.ocupados} de ${capacidad.limite} cupos por categoría`
              : null,
            fijos: capacidad ? `${capacidad.fijo.ocupados} de ${capacidad.fijo.limite}` : null,
            moviles: capacidad ? `${capacidad.movil.ocupados} de ${capacidad.movil.limite}` : null,
            cerca_del_tope: capacidad ? capacidad.cercaDelTope : false,
          }
        : null,
      dispositivos: cliente.dispositivos.map((dispositivo) => ({
        id: dispositivo.id,
        cuenta_id: dispositivo.cuentaId,
        proveedor_device_id: dispositivo.proveedorDeviceId,
        tipo: dispositivo.tipo,
        tipo_proveedor: dispositivo.tipoProveedor,
        estado: dispositivo.estado,
        estado_vinculacion: dispositivo.estadoVinculacion,
        mac: dispositivo.mac,
        nota_descriptiva: dispositivo.notaDescriptiva,
        creado_en: dispositivo.creadoEn,
        // Ventana de vinculación activa (hasta 10 min, sondeo cada 30 s):
        // null si ya se vinculó, si venció o si nunca hubo una.
        ventana_vinculacion: dispositivo.solicitudesVinculacion[0]
          ? {
              expira_en: dispositivo.solicitudesVinculacion[0].expiraEn,
              proximo_sondeo_en: dispositivo.solicitudesVinculacion[0].proximoSondeoEn,
            }
          : null,
      })),
    };
  }

  /**
   * Validación de `id_gestion_externo` (regla 2.4).
   *
   * Nunca cruza datos con otras Empresas Revendedoras: la búsqueda está acotada
   * al tenant por Row-Level Security, y además se filtra explícitamente.
   */
  async buscarCoincidenciasGestionExterna(valor: string): Promise<CoincidenciaGestionExterna[]> {
    if (!valor?.trim()) return [];

    const empresaRevendedoraId = this.contexto.empresaRevendedoraId;
    if (!empresaRevendedoraId) {
      throw new ForbiddenException(
        'La validación de ID de gestión externa corresponde al panel de la Empresa Revendedora.',
      );
    }

    const coincidencias = await this.prisma.db.clienteFinal.findMany({
      where: {
        empresaRevendedoraId,
        idGestionExterno: valor.trim(),
        // La regla habla de "otro Cliente Final activo" de la misma Empresa
        // Revendedora: no tiene sentido advertir por uno dado de baja.
        estado: { in: [EstadoClienteFinal.activo, EstadoClienteFinal.suspendido] },
      },
      include: { dispositivos: { select: { id: true } } },
      orderBy: { numeroCliente: 'asc' },
    });

    return coincidencias.map((cliente) => ({
      id: cliente.id,
      numero_cliente: cliente.numeroCliente,
      nombre: [cliente.nombre, cliente.apellido].filter(Boolean).join(' '),
      estado: cliente.estado,
      dispositivos: cliente.dispositivos.length,
    }));
  }

  // ---------------------------------------------------------------------------
  // Alta (flujo 4.1)
  // ---------------------------------------------------------------------------

  async crear(dto: CrearClienteDto) {
    const empresaRevendedoraId = this.contexto.empresaRevendedoraId;
    if (!empresaRevendedoraId) {
      throw new ForbiddenException(
        'El alta de Clientes Finales la realiza la Empresa Revendedora desde su panel.',
      );
    }

    const operadorPrincipalId = await this.dispositivos.operadorPrincipalId(empresaRevendedoraId);

    // --- Validación de ID de gestión externo (regla 2.4) ---------------------
    if (dto.id_gestion_externo && !dto.confirmar_duplicado && !dto.agrupar_en_cliente_id) {
      const coincidencias = await this.buscarCoincidenciasGestionExterna(dto.id_gestion_externo);
      if (coincidencias.length > 0) {
        // No se bloquea el alta ni se agrupa solo: se devuelve la advertencia
        // para que la Empresa Revendedora elija (agrupar o crear de todos modos).
        throw new ConflictException({
          statusCode: 409,
          error: 'IdGestionExternoDuplicado',
          message:
            'Ya existe un cliente con ese ID de gestión. Elija agrupar el dispositivo en ese ' +
            'cliente o crear un cliente nuevo de todos modos.',
          coincidencias,
        });
      }
    }

    // --- Opción "agrupar": deriva al alta de Dispositivo adicional (flujo 4.4) --
    if (dto.agrupar_en_cliente_id) {
      const resultado = await this.dispositivos.altaAdicional(dto.agrupar_en_cliente_id, {
        notaDescriptiva: dto.dispositivo.nota_descriptiva,
        operadorPrincipalId,
        duracionVentanaCuriosidadMinutos: dto.duracion_ventana_curiosidad_minutos,
      });

      return {
        agrupado_en: dto.agrupar_en_cliente_id,
        cliente: await this.obtener(dto.agrupar_en_cliente_id),
        migro_de_cuenta: resultado.migro,
        cuenta_creada: resultado.cuentaCreada,
        dispositivo_pendiente_de_activacion: resultado.pendienteDeAutoprovision,
      };
    }

    if (
      dto.tipo_alta === TipoAltaClienteFinal.dispositivo_compartido &&
      dto.cupos_por_categoria === undefined
    ) {
      throw new BadRequestException(
        'Seleccione si la venta compartida reserva 1+1 o 2+2 Dispositivos.',
      );
    }
    if (
      dto.tipo_alta === TipoAltaClienteFinal.cuenta_exclusiva &&
      (dto.cupos_por_categoria !== undefined ||
        dto.duracion_ventana_curiosidad_minutos !== undefined)
    ) {
      throw new BadRequestException(
        'Los cupos y la Ventana de curiosidad sólo corresponden a una venta compartida.',
      );
    }

    let servicios: string;
    let cuentaForzadaId: string | undefined;

    if (dto.cuenta_id) {
      // Alta contextual desde una Cuenta existente. Una exclusiva sólo admite
      // su primer titular; una compartida puede sumar ventas mientras tenga
      // capacidad, validada por DispositivosService.
      if (dto.servicios !== undefined) {
        throw new BadRequestException(
          'Esta Cuenta ya tiene servicios fijados: no se pueden re-seleccionar acá.',
        );
      }
      const cuenta = await this.prisma.db.cuenta.findUnique({
        where: { id: dto.cuenta_id },
        include: {
          dispositivos: { select: { estado: true, clienteFinalId: true } },
          ventasCompartidas: { select: { id: true } },
        },
      });
      if (!cuenta) throw new NotFoundException('La Cuenta no existe o no está disponible.');
      const altaExclusiva = dto.tipo_alta === TipoAltaClienteFinal.cuenta_exclusiva;
      if (cuenta.esExclusiva !== altaExclusiva) {
        throw new BadRequestException(
          `Esta Cuenta es ${cuenta.esExclusiva ? 'exclusiva' : 'compartida'}: el tipo de alta no coincide.`,
        );
      }
      if (cuenta.estado !== EstadoCuenta.activa || !cuenta.proveedorCuentaId) {
        throw new BadRequestException(
          'Esta Cuenta todavía no está activa y confirmada por el Proveedor.',
        );
      }
      if (!cuenta.passwordCifrado) {
        throw new BadRequestException(
          'Configure la contraseña de la Cuenta importada antes de agregar Clientes Finales.',
        );
      }
      const tieneClientesActivos = cuenta.dispositivos.some(
        (dispositivo) =>
          ESTADOS_QUE_OCUPAN.includes(dispositivo.estado) && dispositivo.clienteFinalId,
      );
      if (
        cuenta.esExclusiva &&
        (cuenta.clienteFinalExclusivoId ||
          tieneClientesActivos ||
          cuenta.ventasCompartidas.length > 0)
      ) {
        throw new BadRequestException('Esta Cuenta exclusiva ya tiene un Cliente Final asignado.');
      }
      servicios = cuenta.servicios;
      cuentaForzadaId = dto.cuenta_id;
    } else {
      const licencias = await this.proveedor.consultarLicencias(operadorPrincipalId);
      servicios = normalizarServicios(dto.servicios ?? []);
      validarServiciosContratados(servicios, licencias);
    }

    // --- Alta normal ---------------------------------------------------------
    const cliente = await this.prisma.transaction(async (tx) => {
      if (cuentaForzadaId && dto.tipo_alta === TipoAltaClienteFinal.cuenta_exclusiva) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cuentaForzadaId}))`;
      }
      const numeroCliente = await this.identificadores.siguienteNumeroCliente(
        tx,
        empresaRevendedoraId,
      );

      const creado = await tx.clienteFinal.create({
        data: {
          empresaRevendedoraId,
          numeroCliente,
          idGestionExterno: dto.id_gestion_externo?.trim() || null,
          nombre: dto.nombre.trim(),
          apellido: dto.apellido?.trim() || null,
          dni: dto.dni.trim(),
          telefono: dto.telefono?.trim() || null,
          email: dto.email?.trim() || null,
          direccion: dto.direccion?.trim() || null,
          tipoAlta: dto.tipo_alta,
          estado: EstadoClienteFinal.activo,
        },
      });
      if (cuentaForzadaId && dto.tipo_alta === TipoAltaClienteFinal.cuenta_exclusiva) {
        const asignada = await tx.cuenta.updateMany({
          where: { id: cuentaForzadaId, clienteFinalExclusivoId: null },
          data: { clienteFinalExclusivoId: creado.id },
        });
        if (asignada.count !== 1) {
          throw new BadRequestException(
            'Esta Cuenta exclusiva ya tiene un Cliente Final asignado.',
          );
        }
      }
      return creado;
    });

    if (cuentaForzadaId) {
      try {
        if (dto.tipo_alta === TipoAltaClienteFinal.dispositivo_compartido) {
          await this.dispositivos.reservarVentaContextual({
            cuentaId: cuentaForzadaId,
            clienteFinalId: cliente.id,
            empresaRevendedoraId,
            cuposPorCategoria: dto.cupos_por_categoria!,
            operadorPrincipalId,
            duracionVentanaCuriosidadMinutos: dto.duracion_ventana_curiosidad_minutos,
          });
        }
      } catch (error) {
        await this.prisma.db.clienteFinal
          .delete({ where: { id: cliente.id } })
          .catch((cause) =>
            this.logger.error(
              `No se pudo revertir el alta contextual del Cliente Final ${cliente.id}: ${(cause as Error).message}`,
            ),
          );
        throw error;
      }
      await this.audit.registrar({
        accion: AccionAuditoria.alta_cliente,
        entidad: EntidadAuditada.ClienteFinal,
        entidadId: cliente.id,
        empresaRevendedoraId,
        detalle: {
          numero_cliente: cliente.numeroCliente,
          tipo_alta: dto.tipo_alta,
          servicios,
          cupos_por_categoria: dto.cupos_por_categoria ?? null,
          cuenta_id: cuentaForzadaId,
          cuenta_creada: false,
          cargado_manualmente_en_cuenta: true,
          duplicado_confirmado: Boolean(dto.confirmar_duplicado),
        },
      });
      return {
        cliente: await this.obtener(cliente.id),
        cuenta_creada: false,
        dispositivo_pendiente_de_activacion: false,
        solicitud_vinculacion_id: null,
      };
    }

    try {
      const resultado = await this.dispositivos.alta({
        clienteFinal: cliente,
        notaDescriptiva: dto.dispositivo.nota_descriptiva,
        cuentaExclusiva: dto.tipo_alta === TipoAltaClienteFinal.cuenta_exclusiva,
        cuentaIdForzada: cuentaForzadaId,
        operadorPrincipalId,
        servicios,
        cuposPorCategoria: dto.cupos_por_categoria,
        duracionVentanaCuriosidadMinutos: dto.duracion_ventana_curiosidad_minutos,
      });

      await this.audit.registrar({
        accion: AccionAuditoria.alta_cliente,
        entidad: EntidadAuditada.ClienteFinal,
        entidadId: cliente.id,
        empresaRevendedoraId,
        detalle: {
          numero_cliente: cliente.numeroCliente,
          tipo_alta: dto.tipo_alta,
          servicios,
          cupos_por_categoria: dto.cupos_por_categoria ?? null,
          cuenta_id: resultado.cuenta.id,
          cuenta_creada: resultado.cuentaCreada,
          cargado_manualmente_en_cuenta: Boolean(cuentaForzadaId),
          duplicado_confirmado: Boolean(dto.confirmar_duplicado),
        },
      });

      return {
        cliente: await this.obtener(cliente.id),
        cuenta_creada: resultado.cuentaCreada,
        dispositivo_pendiente_de_activacion: resultado.pendienteDeAutoprovision,
        solicitud_vinculacion_id: resultado.solicitudVinculacionId,
      };
    } catch (error) {
      // Compensación: si no se pudo activar el Dispositivo, no queda un Cliente
      // Final "fantasma" sin servicio.
      await this.prisma.db.clienteFinal
        .delete({ where: { id: cliente.id } })
        .catch((cause) =>
          this.logger.error(
            `No se pudo revertir el alta del Cliente Final ${cliente.id}: ${(cause as Error).message}`,
          ),
        );
      throw error;
    }
  }

  async actualizar(id: string, dto: ActualizarClienteDto): Promise<ClienteFinal> {
    if (this.contexto.esOperador) {
      throw new ForbiddenException(
        'Los datos del Cliente Final los administra su Empresa Revendedora.',
      );
    }

    return this.prisma.db.clienteFinal.update({
      where: { id },
      data: {
        nombre: dto.nombre?.trim(),
        apellido: dto.apellido?.trim(),
        dni: dto.dni?.trim(),
        telefono: dto.telefono?.trim(),
        email: dto.email?.trim(),
        direccion: dto.direccion?.trim(),
        idGestionExterno: dto.id_gestion_externo?.trim(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Suspensión, reactivación y baja (flujos 4.2 y 4.3)
  // ---------------------------------------------------------------------------

  /**
   * Suspensión: se libera el Dispositivo en el Proveedor pero queda RESERVADO
   * para el titular. Nadie más puede tomarlo mientras el cliente siga suspendido.
   */
  async suspender(id: string) {
    const cliente = await this.obtenerParaTransicion(id);

    if (cliente.estado === EstadoClienteFinal.suspendido) {
      throw new BadRequestException('El cliente ya está suspendido.');
    }
    if (cliente.estado === EstadoClienteFinal.dado_de_baja) {
      throw new BadRequestException(
        'El cliente está dado de baja: no corresponde suspenderlo. Dé de alta un cliente nuevo.',
      );
    }

    const operadorPrincipalId = await this.dispositivos.operadorPrincipalId(
      cliente.empresaRevendedoraId,
    );

    for (const dispositivo of cliente.dispositivos) {
      if (dispositivo.estado !== EstadoDispositivo.activo) continue;
      await this.dispositivos.liberar(
        dispositivo.id,
        EstadoDispositivo.bloqueado_por_suspension,
        operadorPrincipalId,
        AccionAuditoria.suspension_cliente,
      );
    }

    await this.prisma.transaction(async (tx) => {
      await tx.clienteFinal.update({
        where: { id },
        data: { estado: EstadoClienteFinal.suspendido, suspendidoEn: new Date() },
      });
      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.suspension_cliente,
        entidad: EntidadAuditada.ClienteFinal,
        entidadId: id,
        empresaRevendedoraId: cliente.empresaRevendedoraId,
        detalle: {
          numero_cliente: cliente.numeroCliente,
          dispositivos_bloqueados: cliente.dispositivos.length,
        },
      });
    });

    return this.obtener(id);
  }

  /**
   * Reactivación de un Cliente Final suspendido.
   *
   * Está contemplada en la propia justificación de la regla de suspensión: el
   * Dispositivo se reserva justamente "mientras exista la posibilidad de que el
   * suspendido vuelva a activarse". Se vuelve a habilitar el cupo en el Proveedor
   * y se reactivan sus Dispositivos reservados, sin que hayan pasado por
   * `disponible` en el medio (nadie más pudo tomarlos).
   */
  async reactivar(id: string) {
    const cliente = await this.obtenerParaTransicion(id);

    if (cliente.estado !== EstadoClienteFinal.suspendido) {
      throw new BadRequestException('Sólo se puede reactivar un cliente suspendido.');
    }

    const operadorPrincipalId = await this.dispositivos.operadorPrincipalId(
      cliente.empresaRevendedoraId,
    );

    const reservados = cliente.dispositivos.filter(
      (dispositivo) => dispositivo.estado === EstadoDispositivo.bloqueado_por_suspension,
    );

    for (const dispositivo of reservados) {
      await this.dispositivos
        .reasignar(dispositivo.id, id, operadorPrincipalId, {
          notaDescriptiva: dispositivo.notaDescriptiva ?? undefined,
        })
        .catch(async (error) => {
          // El Dispositivo estaba reservado, así que la reactivación es un alta
          // sobre su propia Cuenta. Si el Proveedor falla, se informa y se corta.
          this.logger.error(
            `No se pudo reactivar el Dispositivo ${dispositivo.id} del Cliente Final ${id}: ` +
              (error as Error).message,
          );
          throw error;
        });
    }

    await this.prisma.transaction(async (tx) => {
      await tx.clienteFinal.update({
        where: { id },
        data: { estado: EstadoClienteFinal.activo, suspendidoEn: null },
      });
      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.reactivacion_cliente,
        entidad: EntidadAuditada.ClienteFinal,
        entidadId: id,
        empresaRevendedoraId: cliente.empresaRevendedoraId,
        detalle: {
          numero_cliente: cliente.numeroCliente,
          dispositivos_reactivados: reservados.length,
        },
      });
    });

    return this.obtener(id);
  }

  /**
   * Baja definitiva: lógica exactamente inversa al alta. Se eliminan los
   * Dispositivos en el Proveedor, se resta la parametrización y los Dispositivos
   * quedan `disponible`, listos para asignarse a un Cliente Final nuevo.
   *
   * También es la ÚNICA vía para liberar un Dispositivo bloqueado por suspensión.
   */
  async darDeBaja(id: string) {
    const cliente = await this.obtenerParaTransicion(id);

    if (cliente.estado === EstadoClienteFinal.dado_de_baja) {
      throw new BadRequestException('El cliente ya está dado de baja.');
    }

    const operadorPrincipalId = await this.dispositivos.operadorPrincipalId(
      cliente.empresaRevendedoraId,
    );
    const veniaDeSuspension = cliente.estado === EstadoClienteFinal.suspendido;

    for (const dispositivo of cliente.dispositivos) {
      if (
        dispositivo.estado !== EstadoDispositivo.activo &&
        dispositivo.estado !== EstadoDispositivo.bloqueado_por_suspension
      ) {
        continue;
      }
      await this.dispositivos.liberar(
        dispositivo.id,
        EstadoDispositivo.disponible,
        operadorPrincipalId,
        AccionAuditoria.baja_cliente,
      );
    }

    await this.prisma.transaction(async (tx) => {
      const ahora = new Date();
      await tx.ventanaCuriosidad.updateMany({
        where: { clienteFinalId: id, finRealEn: null },
        data: {
          finRealEn: ahora,
          motivoFin: MotivoFinVentanaCuriosidad.cancelacion_venta,
          finalizadaPorTeamMemberId: this.contexto.teamMemberId ?? null,
        },
      });
      await tx.clienteFinal.update({
        where: { id },
        data: {
          estado: EstadoClienteFinal.dado_de_baja,
          dadoDeBajaEn: ahora,
        },
      });
      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.baja_cliente,
        entidad: EntidadAuditada.ClienteFinal,
        entidadId: id,
        empresaRevendedoraId: cliente.empresaRevendedoraId,
        detalle: {
          numero_cliente: cliente.numeroCliente,
          dispositivos_liberados: cliente.dispositivos.length,
          transicion_desde_suspension: veniaDeSuspension,
        },
      });
      await tx.ventaCompartida.deleteMany({ where: { clienteFinalId: id } });
    });

    const cuentasCompartidas = [
      ...new Set(cliente.ventasCompartidas.map((venta) => venta.cuentaId)),
    ];
    for (const cuentaId of cuentasCompartidas) {
      await this.dispositivos.sincronizarCapacidadCuenta(cuentaId, operadorPrincipalId);
    }

    return this.obtener(id);
  }

  // ---------------------------------------------------------------------------
  // Auxiliares
  // ---------------------------------------------------------------------------

  private async obtenerParaTransicion(id: string) {
    if (this.contexto.esOperador) {
      throw new ForbiddenException(
        'Las altas, suspensiones y bajas de Clientes Finales las ejecuta su Empresa Revendedora.',
      );
    }

    const cliente = await this.prisma.db.clienteFinal.findUnique({
      where: { id },
      include: { dispositivos: true, ventasCompartidas: true },
    });
    if (!cliente) throw new NotFoundException('El cliente no existe o no está disponible.');
    return cliente;
  }

  /**
   * Vista por ID para el panel del Operador Principal (regla de negocio 4.2).
   *
   * Devuelve exactamente los campos permitidos: número de cliente, estado, tipo
   * de alta, conteo de dispositivos y las Cuentas involucradas. Sin nombre, sin
   * teléfono, sin correo, sin dirección y sin el ID de gestión externa (que es un
   * dato del CRM de la Empresa Revendedora, no del Operador).
   */
  private mapClienteParaOperador(
    cliente: ClienteFinal & {
      dispositivos: { id: string; tipo: string | null; estado: string; cuentaId: string }[];
      cuentasExclusivas?: { id: string }[];
    },
  ) {
    return {
      id: cliente.id,
      numero_cliente: cliente.numeroCliente,
      empresa_revendedora_id: cliente.empresaRevendedoraId,
      estado: cliente.estado,
      tipo_alta: cliente.tipoAlta,
      cantidad_dispositivos: this.contarDispositivosOcupados(cliente.dispositivos),
      cuenta_ids: [
        ...new Set([
          ...cliente.dispositivos.map((dispositivo) => dispositivo.cuentaId),
          ...(cliente.cuentasExclusivas ?? []).map((cuenta) => cuenta.id),
        ]),
      ],
      suspendido_en: cliente.suspendidoEn,
      dado_de_baja_en: cliente.dadoDeBajaEn,
      creado_en: cliente.creadoEn,
    };
  }

  private contarDispositivosOcupados(dispositivos: { estado: string }[]): number {
    return dispositivos.filter(
      (dispositivo) =>
        dispositivo.estado === EstadoDispositivo.activo ||
        dispositivo.estado === EstadoDispositivo.bloqueado_por_suspension,
    ).length;
  }

  private mapCliente(
    cliente: ClienteFinal & {
      dispositivos: { id: string; tipo: string | null; estado: string; cuentaId: string }[];
      cuentasExclusivas?: { id: string }[];
    },
  ) {
    return {
      id: cliente.id,
      numero_cliente: cliente.numeroCliente,
      id_gestion_externo: cliente.idGestionExterno,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      nombre_completo: [cliente.nombre, cliente.apellido].filter(Boolean).join(' '),
      dni: cliente.dni,
      telefono: cliente.telefono,
      email: cliente.email,
      direccion: cliente.direccion,
      tipo_alta: cliente.tipoAlta,
      estado: cliente.estado,
      empresa_revendedora_id: cliente.empresaRevendedoraId,
      cantidad_dispositivos: cliente.dispositivos.filter(
        (dispositivo) =>
          dispositivo.estado === EstadoDispositivo.activo ||
          dispositivo.estado === EstadoDispositivo.bloqueado_por_suspension,
      ).length,
      cuenta_ids: [
        ...new Set([
          ...cliente.dispositivos.map((dispositivo) => dispositivo.cuentaId),
          ...(cliente.cuentasExclusivas ?? []).map((cuenta) => cuenta.id),
        ]),
      ],
      suspendido_en: cliente.suspendidoEn,
      dado_de_baja_en: cliente.dadoDeBajaEn,
      creado_en: cliente.creadoEn,
    };
  }
}
