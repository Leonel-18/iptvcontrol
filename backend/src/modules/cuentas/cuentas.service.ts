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
  MotivoFinVentanaCuriosidad,
  Prisma,
  TipoDispositivo,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { AuditService } from '../../common/audit/audit.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { normalizarServicios, validarServiciosContratados } from '../../proveedor/servicios.util';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { ColaProveedorService } from '../../queues/cola-proveedor.service';
import {
  calcularCapacidad,
  contarDispositivosCliente,
  ESTADOS_QUE_OCUPAN,
  LIMITE_POR_CATEGORIA_COMPARTIDA,
} from './capacidad.util';
import {
  CuentaOperadorDto,
  CuentaRevendedoraDto,
  mapCuentaParaOperador,
  mapCuentaParaRevendedora,
  mapDispositivoParaOperador,
  mapDispositivoParaRevendedora,
} from './cuentas.mapper';
import { ActualizarCuentaDto } from './dto/actualizar-cuenta.dto';
import { AjustarSlotVentaDto } from './dto/ajustar-slot.dto';
import { ListarCuentasQueryDto } from './dto/listar-cuentas.query';
import { CuentasProvisioningService } from './cuentas-provisioning.service';
import { VentanasCuriosidadService } from './ventanas-curiosidad.service';

/**
 * Consultas sobre Cuentas.
 *
 * El aislamiento no se resuelve acá con `if` por rol: las filas que se pueden
 * leer las decide Row-Level Security según el contexto del request. Lo que sí
 * resuelve este servicio es QUÉ CAMPOS de esas filas se serializan, que es la
 * otra mitad de la regla 4.2.
 */
@Injectable()
export class CuentasService {
  private readonly logger = new Logger(CuentasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly contexto: RequestContextService,
    private readonly proveedor: ProveedorService,
    private readonly audit: AuditService,
    private readonly ventanasCuriosidad: VentanasCuriosidadService,
    private readonly provisioning: CuentasProvisioningService,
    private readonly cola: ColaProveedorService,
  ) {}

  async listar(
    query: ListarCuentasQueryDto,
  ): Promise<PaginatedResponse<CuentaOperadorDto | CuentaRevendedoraDto>> {
    const esOperador = this.contexto.esOperador;

    const where: Prisma.CuentaWhereInput = {
      estado: query.status,
      empresaRevendedoraId: query.reseller_id,
      esExclusiva: query.exclusive,
      // El Operador Principal busca por los identificadores que sí le
      // corresponden. Dejarlo filtrar por `usuario` o por el correo de la Cuenta
      // le permitiría confirmar esos valores por prueba y error, y son campos que
      // la regla 4.2 le niega.
      OR: query.q
        ? esOperador
          ? [
              { proveedorCuentaId: { contains: query.q, mode: 'insensitive' } },
              { dniAltaSensa: { contains: query.q } },
            ]
          : [
              { proveedorCuentaId: { contains: query.q, mode: 'insensitive' } },
              { dniAltaSensa: { contains: query.q } },
              { usuario: { contains: query.q, mode: 'insensitive' } },
              { emailContacto: { contains: query.q, mode: 'insensitive' } },
            ]
        : undefined,
    };

    const umbral = await this.umbralAlerta();
    const esCsv = query.esCsv;

    const [total, cuentas] = await Promise.all([
      this.prisma.db.cuenta.count({ where }),
      this.prisma.db.cuenta.findMany({
        where,
        include: {
          dispositivos: { select: { tipo: true, estado: true, clienteFinalId: true } },
          ventasCompartidas: { select: { cuposPorCategoria: true } },
        },
        orderBy: { creadoEn: 'desc' },
        skip: esCsv ? undefined : query.skip,
        take: esCsv ? undefined : query.take,
      }),
    ]);

    const data = cuentas.map((cuenta) => {
      const capacidad = calcularCapacidad(cuenta, umbral);
      // En los listados no se descifran credenciales: descifrar 200 filas por
      // pantalla no aporta y multiplica la exposición del dato sensible.
      return esOperador
        ? mapCuentaParaOperador(cuenta, capacidad)
        : mapCuentaParaRevendedora(cuenta, capacidad, null);
    });

    return PaginatedResponse.build(data, total, query.page ?? 1, query.per_page ?? 25);
  }

  /**
   * Vista por Cuenta (reglas de negocio, sección 8): credenciales,
   * parametrización de contenido y listado de Clientes Finales y Dispositivos
   * relacionados. Para el Operador Principal, la misma URL devuelve la versión
   * recortada.
   */
  async obtener(id: string, revelarCredenciales = false) {
    const cuenta = await this.prisma.db.cuenta.findUnique({
      where: { id },
      include: {
        proveedor: { select: { nombre: true } },
        ventasCompartidas: {
          select: {
            id: true,
            cuposPorCategoria: true,
            clienteFinalId: true,
            clienteFinal: {
              select: { id: true, numeroCliente: true, nombre: true, apellido: true },
            },
          },
        },
        clienteFinalExclusivo: {
          select: { id: true, numeroCliente: true, nombre: true, apellido: true },
        },
        dispositivos: {
          include: {
            clienteFinal: {
              select: { id: true, numeroCliente: true, nombre: true, apellido: true },
            },
          },
          orderBy: [{ tipo: 'asc' }, { creadoEn: 'asc' }],
        },
      },
    });

    if (!cuenta) {
      throw new NotFoundException('La cuenta no existe o no está disponible.');
    }

    const umbral = await this.umbralAlerta();
    const capacidad = calcularCapacidad(cuenta, umbral);

    if (this.contexto.esOperador) {
      return {
        ...mapCuentaParaOperador(cuenta, capacidad, cuenta.proveedor?.nombre),
        dispositivos: cuenta.dispositivos.map(mapDispositivoParaOperador),
      };
    }

    const credenciales = revelarCredenciales
      ? {
          password: this.crypto.tryDecrypt(cuenta.passwordCifrado),
          pin: this.crypto.tryDecrypt(cuenta.pinCifrado),
        }
      : null;

    const ventanas = cuenta.esExclusiva
      ? { activa: null, historial: [] }
      : await this.ventanasCuriosidad.obtenerEstadoEHistorial(cuenta.id);
    return {
      ...mapCuentaParaRevendedora(cuenta, capacidad, credenciales, cuenta.proveedor?.nombre),
      dispositivos: cuenta.dispositivos.map(mapDispositivoParaRevendedora),
      cliente_final_exclusivo: cuenta.clienteFinalExclusivo
        ? {
            id: cuenta.clienteFinalExclusivo.id,
            numero_cliente: cuenta.clienteFinalExclusivo.numeroCliente,
            nombre: [cuenta.clienteFinalExclusivo.nombre, cuenta.clienteFinalExclusivo.apellido]
              .filter(Boolean)
              .join(' '),
          }
        : null,
      // Ventas compartidas con su reserva (1+1/2+2) y cuántos Dispositivos
      // cargó cada Cliente Final: base para editar el slot desde el panel.
      ventas_compartidas: cuenta.ventasCompartidas.map((venta) => ({
        id: venta.id,
        cliente_final: {
          id: venta.clienteFinal.id,
          numero_cliente: venta.clienteFinal.numeroCliente,
          nombre: [venta.clienteFinal.nombre, venta.clienteFinal.apellido]
            .filter(Boolean)
            .join(' '),
        },
        cupos_por_categoria: venta.cuposPorCategoria,
        ocupacion: {
          fijos: contarDispositivosCliente(
            cuenta.dispositivos,
            venta.clienteFinalId,
            TipoDispositivo.fijo,
          ),
          moviles: contarDispositivosCliente(
            cuenta.dispositivos,
            venta.clienteFinalId,
            TipoDispositivo.movil,
          ),
        },
      })),
      clientes_finales: this.resumirClientes(cuenta.dispositivos, [
        ...(cuenta.clienteFinalExclusivo ? [cuenta.clienteFinalExclusivo] : []),
        ...cuenta.ventasCompartidas.map((venta) => venta.clienteFinal),
      ]),
      ventana_curiosidad: ventanas.activa,
      historial_ventanas_curiosidad: ventanas.historial,
    };
  }

  /**
   * Credenciales en claro de una Cuenta.
   *
   * Sólo para el panel de la Empresa Revendedora dueña: el Operador Principal no
   * accede ni por endpoint propio (regla 4.2). Queda pendiente de definición con
   * Federico si además conviene registrar cada consulta a estos campos
   * (docs/05_Decisiones_Pendientes.md, sección 3); por eso el acceso está
   * concentrado en este único método, para que sumar ese registro después sea un
   * cambio de una línea y no una búsqueda por todo el código.
   */
  async obtenerCredenciales(id: string): Promise<{
    usuario: string;
    password: string | null;
    pin: string | null;
    email_contacto: string;
  }> {
    if (this.contexto.esOperador) {
      throw new ForbiddenException(
        'El Operador Principal no tiene acceso a las credenciales de las Cuentas de sus Empresas Revendedoras.',
      );
    }

    const cuenta = await this.prisma.db.cuenta.findUnique({ where: { id } });
    if (!cuenta) {
      throw new NotFoundException('La cuenta no existe o no está disponible.');
    }

    return {
      usuario: cuenta.usuario,
      password: this.crypto.tryDecrypt(cuenta.passwordCifrado),
      pin: this.crypto.tryDecrypt(cuenta.pinCifrado),
      email_contacto: cuenta.emailContacto,
    };
  }

  /**
   * Reemplaza manualmente la contraseña de la Cuenta en el Proveedor. La
   * generada automáticamente en el alta sigue siendo la de por defecto; esto
   * es la corrección puntual para cuando la Empresa Revendedora necesita
   * definir una a mano (pedido de Bruno, 26/08/2026).
   */
  async cambiarPassword(id: string, passwordNueva: string): Promise<{ id: string }> {
    if (this.contexto.esOperador) {
      throw new ForbiddenException(
        'El Operador Principal no administra las credenciales de las Cuentas de sus Empresas Revendedoras.',
      );
    }

    const cuenta = await this.prisma.db.cuenta.findUnique({ where: { id } });
    if (!cuenta) {
      throw new NotFoundException('La cuenta no existe o no está disponible.');
    }
    if (!cuenta.proveedorCuentaId) {
      throw new BadRequestException(
        'Esta Cuenta todavía no se confirmó en el Proveedor: espere a que termine de crearse.',
      );
    }

    const operadorPrincipalId = await this.operadorDeCuenta(cuenta.empresaRevendedoraId);
    await this.proveedor.actualizarPassword(operadorPrincipalId, {
      proveedorCuentaId: cuenta.proveedorCuentaId,
      password: passwordNueva,
    });

    await this.prisma.db.cuenta.update({
      where: { id },
      data: { passwordCifrado: this.crypto.encrypt(passwordNueva) },
    });

    await this.audit.registrar({
      accion: AccionAuditoria.cambio_password_cuenta,
      entidad: EntidadAuditada.Cuenta,
      entidadId: id,
      empresaRevendedoraId: cuenta.empresaRevendedoraId,
      // Nunca se guarda la contraseña en el detalle del log de auditoría.
      detalle: { proveedor_cuenta_id: cuenta.proveedorCuentaId, modificado_manualmente: true },
    });

    return { id };
  }

  /**
   * Sincroniza la parametrización de contenido con el Proveedor.
   *
   * La API de SENSA no tiene webhooks, así que la única forma de enterarse de un
   * cambio hecho por fuera de IPTVControl es preguntar (polling).
   */
  async sincronizarServicios(id: string) {
    const cuenta = await this.prisma.db.cuenta.findUnique({ where: { id } });
    if (!cuenta) throw new NotFoundException('La cuenta no existe o no está disponible.');
    if (!cuenta.proveedorCuentaId) {
      return { servicios: cuenta.servicios, plan: null, sincronizada: false };
    }

    const operadorPrincipalId = await this.operadorDeCuenta(cuenta.empresaRevendedoraId);
    const servicios = await this.proveedor.consultarServicios(
      operadorPrincipalId,
      cuenta.proveedorCuentaId,
    );

    await this.prisma.db.cuenta.update({
      where: { id },
      data: { servicios: servicios.servicios || cuenta.servicios },
    });

    return { servicios: servicios.servicios, plan: servicios.plan, sincronizada: true };
  }

  /**
   * Edita propiedades de una Cuenta ya creada: tipo (exclusiva ↔ compartida)
   * y/o su parametrización de servicios.
   *
   * Cambiar de tipo sólo es posible si la Cuenta tiene a lo sumo un Cliente
   * Final activo: de exclusiva a compartida, además, ese cliente no puede
   * tener más de 2 Dispositivos fijos ni 2 móviles (el máximo de una venta es
   * 2+2). Los servicios se validan siempre contra lo contratado, sin importar
   * el tipo de Cuenta (el básico se agrega siempre desde `normalizarServicios`).
   */
  async actualizarPropiedades(id: string, dto: ActualizarCuentaDto) {
    if (this.contexto.esOperador) {
      throw new ForbiddenException(
        'El Operador Principal no administra las propiedades de las Cuentas de sus Empresas Revendedoras.',
      );
    }
    if (dto.es_exclusiva === undefined && dto.servicios === undefined) {
      throw new BadRequestException('Informe al menos un cambio: tipo de Cuenta o servicios.');
    }

    const cuenta = await this.prisma.db.cuenta.findUnique({
      where: { id },
      include: {
        dispositivos: { select: { tipo: true, estado: true, clienteFinalId: true } },
        ventasCompartidas: { select: { clienteFinalId: true, cuposPorCategoria: true } },
      },
    });
    if (!cuenta) throw new NotFoundException('La cuenta no existe o no está disponible.');
    if (!cuenta.proveedorCuentaId) {
      throw new BadRequestException(
        'Esta Cuenta todavía no se confirmó en el Proveedor: espere a que termine de crearse.',
      );
    }

    const operadorPrincipalId = await this.operadorDeCuenta(cuenta.empresaRevendedoraId);
    const esExclusivaFinal = dto.es_exclusiva ?? cuenta.esExclusiva;
    const cambiaTipo = esExclusivaFinal !== cuenta.esExclusiva;

    const clientesRelacionados = new Set(
      cuenta.dispositivos
        .filter((d) => ESTADOS_QUE_OCUPAN.includes(d.estado) && d.clienteFinalId)
        .map((d) => d.clienteFinalId as string),
    );
    for (const venta of cuenta.ventasCompartidas) {
      clientesRelacionados.add(venta.clienteFinalId);
    }
    if (cuenta.clienteFinalExclusivoId) {
      clientesRelacionados.add(cuenta.clienteFinalExclusivoId);
    }

    if (cambiaTipo) {
      // Regla de negocio confirmada: la Cuenta exclusiva NO puede pasar a
      // compartida. La única conversión permitida es compartida → exclusiva,
      // y sólo cuando la Cuenta tiene a lo sumo un Cliente Final activo (el
      // resto de los cupos reservados quedan liberados).
      if (!esExclusivaFinal) {
        throw new BadRequestException(
          'Una Cuenta exclusiva no puede convertirse en compartida: el tipo se fija al crearla.',
        );
      }
      if (clientesRelacionados.size > 1) {
        throw new BadRequestException(
          'La Cuenta compartida tiene más de un Cliente Final activo: no puede pasar a exclusiva.',
        );
      }
    }

    let serviciosNuevos: string | undefined;
    if (dto.servicios !== undefined) {
      const licencias = await this.proveedor.consultarLicencias(operadorPrincipalId);
      serviciosNuevos = normalizarServicios(dto.servicios);
      validarServiciosContratados(serviciosNuevos, licencias);
    }
    const cambiaServicios = serviciosNuevos !== undefined && serviciosNuevos !== cuenta.servicios;

    // Se empuja primero al Proveedor: si SENSA rechaza los servicios nuevos,
    // no queda ningún cambio a medias en la base local.
    if (cambiaServicios) {
      await this.proveedor.actualizarServicios(operadorPrincipalId, {
        proveedorCuentaId: cuenta.proveedorCuentaId,
        servicios: serviciosNuevos!,
      });
    }

    const ahora = new Date();
    await this.prisma.transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;

      if (cambiaTipo && esExclusivaFinal) {
        await tx.ventaCompartida.deleteMany({ where: { cuentaId: id } });
        await tx.ventanaCuriosidad.updateMany({
          where: { cuentaId: id, finRealEn: null },
          data: { finRealEn: ahora, motivoFin: MotivoFinVentanaCuriosidad.cancelacion_venta },
        });
      }

      await tx.cuenta.update({
        where: { id },
        data: {
          esExclusiva: esExclusivaFinal,
          ...(cambiaTipo
            ? {
                clienteFinalExclusivoId: esExclusivaFinal
                  ? ([...clientesRelacionados][0] ?? null)
                  : null,
              }
            : {}),
          servicios: serviciosNuevos ?? cuenta.servicios,
        },
      });

      if (cambiaTipo) {
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.cambio_tipo_cuenta,
          entidad: EntidadAuditada.Cuenta,
          entidadId: id,
          empresaRevendedoraId: cuenta.empresaRevendedoraId,
          detalle: { de_exclusiva: cuenta.esExclusiva, a_exclusiva: esExclusivaFinal },
        });
      }
      if (cambiaServicios) {
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.cambio_servicios_cuenta,
          entidad: EntidadAuditada.Cuenta,
          entidadId: id,
          empresaRevendedoraId: cuenta.empresaRevendedoraId,
          detalle: { servicios_anteriores: cuenta.servicios, servicios_nuevos: serviciosNuevos },
        });
      }
    });

    if (cambiaTipo) {
      try {
        await this.provisioning.aplicarLimiteExclusiva(id, operadorPrincipalId);
      } catch (error) {
        this.logger.warn(
          `No se pudieron sincronizar los contadores tras cambiar el tipo de la Cuenta ${id}: ` +
            `${(error as Error).message}. Se encola un reintento.`,
        );
        await this.cola.encolarSincronizacionContadoresVenta({ cuentaId: id, operadorPrincipalId });
      }
    }

    return this.obtener(id);
  }

  /**
   * Ajusta la reserva (slot 1+1/2+2) de una venta compartida y sincroniza los
   * contadores del Proveedor. Herramienta manual del vendedor para acomodar la
   * carga de Dispositivos de un Cliente Final (docs 03, sección 2).
   *
   * - Subir (1+1 → 2+2): la suma de cupos de todas las ventas de la Cuenta no
   *   puede superar el máximo de 3 por categoría.
   * - Bajar (2+2 → 1+1): se rechaza si el Cliente Final ya cargó más de un
   *   Dispositivo de alguna categoría en la Cuenta.
   */
  async ajustarSlotVentaCompartida(
    cuentaId: string,
    clienteFinalId: string,
    dto: AjustarSlotVentaDto,
  ) {
    if (this.contexto.esOperador) {
      throw new ForbiddenException(
        'El Operador Principal no administra los cupos de las ventas de sus Empresas Revendedoras.',
      );
    }
    const nuevo = dto.cupos_por_categoria;

    const cuenta = await this.prisma.db.cuenta.findUnique({
      where: { id: cuentaId },
      include: {
        ventasCompartidas: { select: { clienteFinalId: true, cuposPorCategoria: true } },
        dispositivos: { select: { tipo: true, estado: true, clienteFinalId: true } },
      },
    });
    if (!cuenta) throw new NotFoundException('La cuenta no existe o no está disponible.');
    if (cuenta.esExclusiva) {
      throw new BadRequestException('Una Cuenta exclusiva no tiene ventas compartidas.');
    }
    const venta = cuenta.ventasCompartidas.find((item) => item.clienteFinalId === clienteFinalId);
    if (!venta) {
      throw new NotFoundException('Este Cliente Final no tiene una venta en esta Cuenta.');
    }
    if (venta.cuposPorCategoria === nuevo) return this.obtener(cuentaId);

    if (nuevo > venta.cuposPorCategoria) {
      const suma = cuenta.ventasCompartidas.reduce(
        (total, item) => total + item.cuposPorCategoria,
        0,
      );
      if (suma - venta.cuposPorCategoria + nuevo > LIMITE_POR_CATEGORIA_COMPARTIDA) {
        throw new BadRequestException(
          'No quedan cupos en esta Cuenta para agrandar la venta. Use otra Cuenta compatible o cree una nueva.',
        );
      }
    } else {
      const fijos = contarDispositivosCliente(
        cuenta.dispositivos,
        clienteFinalId,
        TipoDispositivo.fijo,
      );
      const moviles = contarDispositivosCliente(
        cuenta.dispositivos,
        clienteFinalId,
        TipoDispositivo.movil,
      );
      if (fijos > 1 || moviles > 1) {
        throw new BadRequestException(
          `Este Cliente Final ya cargó ${fijos} fijo(s) y ${moviles} móvil(es): no se puede reducir su venta a 1+1.`,
        );
      }
    }

    await this.prisma.transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cuentaId}))`;
      await tx.ventaCompartida.updateMany({
        where: { cuentaId, clienteFinalId },
        data: { cuposPorCategoria: nuevo },
      });
      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.cambio_slots_cuenta,
        entidad: EntidadAuditada.Cuenta,
        entidadId: cuentaId,
        empresaRevendedoraId: cuenta.empresaRevendedoraId,
        detalle: {
          cliente_final_id: clienteFinalId,
          cupos_anterior: venta.cuposPorCategoria,
          cupos_nuevo: nuevo,
        },
      });
    });

    const operadorPrincipalId = await this.operadorDeCuenta(cuenta.empresaRevendedoraId);
    try {
      await this.provisioning.sincronizarContadoresVenta(cuentaId, operadorPrincipalId);
    } catch (error) {
      this.logger.warn(
        `No se pudo sincronizar el contador tras ajustar el slot de la Cuenta ${cuentaId}: ` +
          `${(error as Error).message}. Se encola un reintento.`,
      );
      await this.cola.encolarSincronizacionContadoresVenta({ cuentaId, operadorPrincipalId });
    }
    return this.obtener(cuentaId);
  }

  /**
   * Reemplaza manualmente el PIN de control parental de la Cuenta en el
   * Proveedor (espejo de `cambiarPassword`): la Empresa Revendedora puede
   * definirlo a mano cuando lo necesite (pedido de la demo con el cliente).
   */
  async cambiarPin(id: string, pinNuevo: string): Promise<{ id: string }> {
    if (this.contexto.esOperador) {
      throw new ForbiddenException(
        'El Operador Principal no administra las credenciales de las Cuentas de sus Empresas Revendedoras.',
      );
    }

    const cuenta = await this.prisma.db.cuenta.findUnique({ where: { id } });
    if (!cuenta) {
      throw new NotFoundException('La cuenta no existe o no está disponible.');
    }
    if (!cuenta.proveedorCuentaId) {
      throw new BadRequestException(
        'Esta Cuenta todavía no se confirmó en el Proveedor: espere a que termine de crearse.',
      );
    }

    const operadorPrincipalId = await this.operadorDeCuenta(cuenta.empresaRevendedoraId);
    await this.proveedor.actualizarPin(operadorPrincipalId, {
      proveedorCuentaId: cuenta.proveedorCuentaId,
      pin: pinNuevo,
    });

    await this.prisma.db.cuenta.update({
      where: { id },
      data: { pinCifrado: this.crypto.encrypt(pinNuevo) },
    });

    await this.audit.registrar({
      accion: AccionAuditoria.cambio_pin_cuenta,
      entidad: EntidadAuditada.Cuenta,
      entidadId: id,
      empresaRevendedoraId: cuenta.empresaRevendedoraId,
      // Nunca se guarda el PIN en el detalle del log de auditoría.
      detalle: { proveedor_cuenta_id: cuenta.proveedorCuentaId, modificado_manualmente: true },
    });

    return { id };
  }

  /**
   * Cierra una Cuenta sin uso (ej. creada por error, o que quedó abandonada).
   *
   * No se puede cerrar una Cuenta con Dispositivos ocupando lugar: primero hay
   * que dar de baja a esos Clientes Finales. Si la Cuenta nunca llegó a
   * confirmarse en el Proveedor (falló el alta a mitad de camino), sólo se
   * borra la reserva local; si ya tiene `proveedor_cuenta_id`, se cierra
   * también en SENSA antes de marcarla localmente.
   */
  async cerrar(id: string): Promise<{ id: string; estado: EstadoCuenta }> {
    const cuenta = await this.prisma.db.cuenta.findUnique({
      where: { id },
      include: {
        dispositivos: { select: { estado: true } },
        ventasCompartidas: { select: { id: true } },
      },
    });
    if (!cuenta) {
      throw new NotFoundException('La cuenta no existe o no está disponible.');
    }
    if (cuenta.estado === EstadoCuenta.cerrada) {
      throw new BadRequestException('La Cuenta ya está cerrada.');
    }
    const tieneDispositivosOcupando = cuenta.dispositivos.some((dispositivo) =>
      ESTADOS_QUE_OCUPAN.includes(dispositivo.estado),
    );
    if (tieneDispositivosOcupando || cuenta.ventasCompartidas.length > 0) {
      throw new BadRequestException(
        'No se puede cerrar una Cuenta con Dispositivos activos o bloqueados por suspensión. ' +
          'Dé de baja a esos Clientes Finales primero.',
      );
    }

    if (!cuenta.proveedorCuentaId) {
      // Nunca se confirmó en el Proveedor: no hay nada que cerrar allá.
      await this.prisma.db.cuenta.delete({ where: { id } });
      await this.audit.registrar({
        accion: AccionAuditoria.cierre_cuenta,
        entidad: EntidadAuditada.Cuenta,
        entidadId: id,
        empresaRevendedoraId: cuenta.empresaRevendedoraId,
        detalle: { proveedor_cuenta_id: null, motivo: 'nunca_confirmada_en_proveedor' },
      });
      return { id, estado: EstadoCuenta.cerrada };
    }

    const operadorPrincipalId = await this.operadorDeCuenta(cuenta.empresaRevendedoraId);
    await this.proveedor.cerrarCuenta(operadorPrincipalId, cuenta.proveedorCuentaId);

    await this.prisma.db.cuenta.update({
      where: { id },
      data: { estado: EstadoCuenta.cerrada },
    });
    await this.audit.registrar({
      accion: AccionAuditoria.cierre_cuenta,
      entidad: EntidadAuditada.Cuenta,
      entidadId: id,
      empresaRevendedoraId: cuenta.empresaRevendedoraId,
      detalle: { proveedor_cuenta_id: cuenta.proveedorCuentaId },
    });
    return { id, estado: EstadoCuenta.cerrada };
  }

  /** Cuentas cerca del tope, para el aviso visual del panel (regla 12). */
  async alertasCapacidad(empresaRevendedoraId?: string) {
    const umbral = await this.umbralAlerta();
    const cuentas = await this.prisma.db.cuenta.findMany({
      where: {
        estado: EstadoCuenta.activa,
        empresaRevendedoraId,
      },
      include: {
        dispositivos: { select: { tipo: true, estado: true, clienteFinalId: true } },
        ventasCompartidas: { select: { cuposPorCategoria: true } },
      },
    });

    return cuentas
      .map((cuenta) => ({ cuenta, capacidad: calcularCapacidad(cuenta, umbral) }))
      .filter(({ capacidad }) => capacidad.cercaDelTope)
      .map(({ cuenta, capacidad }) => ({
        cuenta_id: cuenta.id,
        proveedor_cuenta_id: cuenta.proveedorCuentaId,
        dispositivos: capacidad.esExclusiva
          ? `${capacidad.ocupados} de ${capacidad.limite}`
          : `${capacidad.ocupados} de ${capacidad.limite} cupos por categoría`,
        fijos: `${capacidad.fijo.ocupados} de ${capacidad.fijo.limite}`,
        moviles: `${capacidad.movil.ocupados} de ${capacidad.movil.limite}`,
        completa: capacidad.completa,
        mensaje: capacidad.completa
          ? capacidad.esExclusiva
            ? 'La Cuenta llegó al límite de 3 fijos y 3 móviles.'
            : 'La Cuenta comprometió sus 3 cupos por categoría.'
          : 'La cuenta está cerca del límite de capacidad.',
      }));
  }

  /** Umbral configurado por el Operador Principal (por defecto 2 de 3). */
  async umbralAlerta(): Promise<number> {
    const operadorId = this.contexto.operadorPrincipalId;
    if (!operadorId) return 2;
    const operador = await this.prisma.operadorPrincipal.findUnique({
      where: { id: operadorId },
      select: { umbralAlertaCapacidad: true },
    });
    return operador?.umbralAlertaCapacidad ?? 2;
  }

  private async operadorDeCuenta(empresaRevendedoraId: string): Promise<string> {
    const contexto = this.contexto.operadorPrincipalId;
    if (contexto) return contexto;
    const empresa = await this.prisma.empresaRevendedora.findUniqueOrThrow({
      where: { id: empresaRevendedoraId },
      select: { operadorPrincipalId: true },
    });
    return empresa.operadorPrincipalId;
  }

  private resumirClientes(
    dispositivos: {
      clienteFinal?: {
        id: string;
        numeroCliente: number;
        nombre: string;
        apellido: string | null;
      } | null;
    }[],
    clientesRelacionados: {
      id: string;
      numeroCliente: number;
      nombre: string;
      apellido: string | null;
    }[] = [],
  ) {
    const mapa = new Map<
      string,
      { id: string; numero_cliente: number; nombre: string; dispositivos: number }
    >();

    for (const cliente of clientesRelacionados) {
      mapa.set(cliente.id, {
        id: cliente.id,
        numero_cliente: cliente.numeroCliente,
        nombre: [cliente.nombre, cliente.apellido].filter(Boolean).join(' '),
        dispositivos: 0,
      });
    }

    for (const dispositivo of dispositivos) {
      const cliente = dispositivo.clienteFinal;
      if (!cliente) continue;
      const existente = mapa.get(cliente.id);
      if (existente) {
        existente.dispositivos += 1;
        continue;
      }
      mapa.set(cliente.id, {
        id: cliente.id,
        numero_cliente: cliente.numeroCliente,
        nombre: [cliente.nombre, cliente.apellido].filter(Boolean).join(' '),
        dispositivos: 1,
      });
    }

    return [...mapa.values()];
  }
}
