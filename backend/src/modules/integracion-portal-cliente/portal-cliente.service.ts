import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Cuenta,
  Dispositivo,
  EstadoClienteFinal,
  EstadoIncidenciaDispositivo,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { CuentasService } from '../cuentas/cuentas.service';
import { ClientesService } from '../clientes/clientes.service';
import { InventarioProveedorService } from '../cuentas/inventario-proveedor.service';
import { nombresDeServicios } from '../cuentas/cuentas.mapper';
import { DispositivosService } from '../dispositivos/dispositivos.service';
import { IncidenciasDispositivosService } from '../dispositivos/incidencias-dispositivos.service';

/**
 * =============================================================================
 * Portal de Cliente externo
 * =============================================================================
 * El Cliente Final (identificado por DNI) consulta sus credenciales, servicios y
 * dispositivos. Las operaciones sobre una Cuenta se identifican por el ID de la
 * Cuenta en el Proveedor y funcionan tanto en exclusivas como en compartidas.
 * En compartidas, cambiar contraseña/PIN/servicios exige confirmación explícita
 * porque afecta a todos sus Clientes Finales.
 *
 * No reimplementa nada: delega en `CuentasService` e `InventarioProveedorService`
 * / `DispositivosService`, los mismos caminos que usa el panel, y así conserva
 * SENSA (vía `ProveedorAdapter`), validaciones y Audit Log.
 */
@Injectable()
export class PortalClienteService {
  private readonly logger = new Logger(PortalClienteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
    private readonly cuentas: CuentasService,
    private readonly clientes: ClientesService,
    private readonly inventario: InventarioProveedorService,
    private readonly dispositivos: DispositivosService,
    private readonly incidencias: IncidenciasDispositivosService,
  ) {}

  /** Datos del cliente, sus cuentas, credenciales, servicios y dispositivos. */
  async sesion(dni: string) {
    const cliente = await this.buscarCliente(dni);
    const cuentas = await this.cuentasDelCliente(cliente.id);
    const cuentasDto = await Promise.all(
      cuentas.map((cuenta) => this.armarCuentaDto(cuenta, cliente.id)),
    );

    return {
      cliente: {
        id: cliente.id,
        numero_cliente: cliente.numeroCliente,
        nombre_completo: [cliente.nombre, cliente.apellido].filter(Boolean).join(' '),
        dni: cliente.dni,
        estado: cliente.estado,
      },
      cuentas: cuentasDto,
    };
  }

  /** Lee una Cuenta por su ID en el Proveedor. */
  async obtenerCuenta(proveedorCuentaId: string) {
    const cuenta = await this.buscarCuentaPorProveedor(proveedorCuentaId);
    const credenciales = await this.cuentas.obtenerCredenciales(cuenta.id);
    const dispositivos = await this.prisma.db.dispositivo.findMany({
      where: { cuentaId: cuenta.id },
      include: {
        clienteFinal: { select: { id: true, numeroCliente: true, nombre: true, apellido: true } },
      },
      orderBy: { creadoEn: 'asc' },
    });

    return {
      id: cuenta.id,
      proveedor_cuenta_id: cuenta.proveedorCuentaId,
      es_exclusiva: cuenta.esExclusiva,
      es_prueba: cuenta.esPrueba,
      prueba_vence_en: cuenta.esPrueba ? cuenta.pruebaVenceEn : null,
      aislada: cuenta.aislada,
      estado: cuenta.estado,
      usuario: credenciales.usuario,
      password: credenciales.password,
      pin: credenciales.pin,
      servicios: cuenta.servicios,
      servicios_nombres: nombresDeServicios(cuenta.servicios),
      puede_editar: cuenta.estado === 'activa',
      puede_cambiar_password: cuenta.estado === 'activa',
      requiere_confirmacion_cambio_compartida: !cuenta.esExclusiva,
      dispositivos: dispositivos.map((dispositivo) => ({
        ...this.mapDispositivo(dispositivo),
        cliente_final: dispositivo.clienteFinal
          ? {
              id: dispositivo.clienteFinal.id,
              numero_cliente: dispositivo.clienteFinal.numeroCliente,
              nombre: [dispositivo.clienteFinal.nombre, dispositivo.clienteFinal.apellido]
                .filter(Boolean)
                .join(' '),
            }
          : null,
      })),
    };
  }

  /** Búsqueda liviana del Cliente por DNI o ID de CRM, con sus Cuentas. */
  async buscarClienteResumen(dni?: string, idGestionExterno?: string) {
    if (!dni && !idGestionExterno) {
      throw new BadRequestException('Indique `dni` o `id_gestion_externo`.');
    }

    const cliente = dni
      ? await this.buscarCliente(dni)
      : await this.buscarClientePorGestion(idGestionExterno!);
    const cuentas = await this.cuentasDelCliente(cliente.id);

    return {
      cliente: this.mapClienteResumen(cliente),
      cuentas: cuentas.map((cuenta) => ({
        id: cuenta.id,
        proveedor_cuenta_id: cuenta.proveedorCuentaId,
        es_exclusiva: cuenta.esExclusiva,
        estado: cuenta.estado,
        servicios: cuenta.servicios,
        servicios_nombres: nombresDeServicios(cuenta.servicios),
        dispositivos: cuenta.dispositivos.length,
      })),
    };
  }

  /** Lee un Dispositivo por Cuenta + ID de Proveedor. */
  async obtenerDispositivo(proveedorCuentaId: string, proveedorDeviceId: string) {
    const cuenta = await this.buscarCuentaPorProveedor(proveedorCuentaId);
    const dispositivo = await this.prisma.db.dispositivo.findFirst({
      where: { cuentaId: cuenta.id, proveedorDeviceId },
      include: {
        clienteFinal: { select: { id: true, numeroCliente: true, nombre: true, apellido: true } },
      },
    });
    if (!dispositivo) {
      throw new NotFoundException('El Dispositivo no pertenece a esta Cuenta.');
    }
    return {
      ...this.mapDispositivo(dispositivo),
      cuenta_id: cuenta.id,
      proveedor_cuenta_id: cuenta.proveedorCuentaId,
      cliente_final: dispositivo.clienteFinal
        ? {
            id: dispositivo.clienteFinal.id,
            numero_cliente: dispositivo.clienteFinal.numeroCliente,
            nombre: [dispositivo.clienteFinal.nombre, dispositivo.clienteFinal.apellido]
              .filter(Boolean)
              .join(' '),
          }
        : null,
    };
  }

  /** Actualiza los datos de contacto de un Cliente (por DNI). */
  async actualizarCliente(
    dni: string,
    dto: {
      nombre?: string;
      apellido?: string;
      telefono?: string;
      email?: string;
      direccion?: string;
      id_gestion_externo?: string;
    },
  ) {
    const cliente = await this.buscarCliente(dni);
    const actualizado = await this.clientes.actualizar(cliente.id, dto);
    return { cliente: this.mapClienteResumen(actualizado) };
  }

  async suspenderCliente(dni: string) {
    const cliente = await this.buscarCliente(dni);
    const actualizado = await this.clientes.suspender(cliente.id);
    return { cliente: this.mapDetalleResumen(actualizado) };
  }

  async reactivarCliente(dni: string) {
    const cliente = await this.buscarCliente(dni);
    const actualizado = await this.clientes.reactivar(cliente.id);
    return { cliente: this.mapDetalleResumen(actualizado) };
  }

  async darDeBajaCliente(dni: string, confirmarBajaDefinitiva = false) {
    if (!confirmarBajaDefinitiva) {
      throw new ConflictException({
        statusCode: 409,
        error: 'ClientTerminationConfirmationRequired',
        message:
          'Dar de baja al Cliente elimina sus Dispositivos en el Proveedor y libera sus Cuentas. ' +
          'Reenviar con "confirmar_baja_definitiva": true para continuar.',
      });
    }
    const cliente = await this.buscarCliente(dni);
    const actualizado = await this.clientes.darDeBaja(cliente.id);
    return { cliente: this.mapDetalleResumen(actualizado) };
  }

  /**
   * Cambia la contraseña de una Cuenta, sin importar si es exclusiva o compartida.
   *
   * La Cuenta se identifica por su ID en el Proveedor (`proveedorCuentaId`).
   * En una compartida la contraseña la usan todos sus Clientes Finales, por eso
   * se exige `confirmar_cambio_compartida: true` y se devuelve una advertencia.
   */
  async cambiarPassword(
    proveedorCuentaId: string,
    password: string,
    confirmarCambioCompartida = false,
  ) {
    const cuenta = await this.buscarCuentaActiva(proveedorCuentaId);
    this.exigirConfirmacionCompartida(cuenta, confirmarCambioCompartida, 'contraseña');

    const resultado = await this.cuentas.cambiarPassword(cuenta.id, password);
    return this.respuestaEdicion(cuenta, resultado);
  }

  /** Cambia el PIN de una Cuenta (exclusiva o compartida). */
  async cambiarPin(
    proveedorCuentaId: string,
    pin: string,
    confirmarCambioCompartida = false,
  ) {
    const cuenta = await this.buscarCuentaActiva(proveedorCuentaId);
    this.exigirConfirmacionCompartida(cuenta, confirmarCambioCompartida, 'PIN');

    const resultado = await this.cuentas.cambiarPin(cuenta.id, pin);
    return this.respuestaEdicion(cuenta, resultado);
  }

  /** Cambia los servicios de una Cuenta (exclusiva o compartida). */
  async cambiarServicios(
    proveedorCuentaId: string,
    servicios: string[],
    confirmarCambioCompartida = false,
  ) {
    const cuenta = await this.buscarCuentaActiva(proveedorCuentaId);
    this.exigirConfirmacionCompartida(cuenta, confirmarCambioCompartida, 'contenido');

    const resultado = await this.cuentas.actualizarPropiedades(cuenta.id, { servicios });
    return this.respuestaEdicion(cuenta, resultado);
  }

  /** Inventario completo del proveedor para una Cuenta (exclusiva o compartida). */
  async sincronizarDispositivos(proveedorCuentaId: string) {
    const cuenta = await this.buscarCuentaActiva(proveedorCuentaId);
    return this.inventario.sincronizar(cuenta.id);
  }

  /**
   * Asigna a un Cliente Final un Dispositivo detectado sin dueño. El DNI sigue
   * siendo necesario porque hay que decidir a quién se le asigna.
   */
  async reclamarDispositivo(
    proveedorCuentaId: string,
    dni: string,
    proveedorDeviceId: string,
  ) {
    const cuenta = await this.buscarCuentaActiva(proveedorCuentaId);
    const { cliente } = await this.validarCuentaDelCliente(dni, cuenta.id, {
      permitirCompartida: true,
    });

    const incidencia = await this.prisma.db.incidenciaDispositivoProveedor.findFirst({
      where: {
        cuentaId: cuenta.id,
        proveedorDeviceId,
        estado: EstadoIncidenciaDispositivo.pendiente,
      },
      select: { id: true },
    });
    if (!incidencia) {
      throw new NotFoundException(
        'No hay un Dispositivo pendiente en el proveedor con ese identificador.',
      );
    }
    return this.incidencias.resolver(incidencia.id, 'vincular', cliente.id);
  }

  /**
   * Baja definitiva de un Dispositivo de la Cuenta, identificado por su ID en el
   * Proveedor. No requiere DNI: la Cuenta se identifica por su ID de proveedor.
   */
  async darDeBajaDispositivo(
    proveedorCuentaId: string,
    proveedorDeviceId: string,
    confirmarBajaDefinitiva = false,
  ) {
    if (!confirmarBajaDefinitiva) {
      throw new ConflictException({
        statusCode: 409,
        error: 'DeviceRemovalConfirmationRequired',
        message:
          'La baja elimina el Dispositivo en el Proveedor y la fila local, y es irreversible. ' +
          'Reenviar con "confirmar_baja_definitiva": true para continuar.',
      });
    }
    const cuenta = await this.buscarCuentaActiva(proveedorCuentaId);

    const dispositivo = await this.prisma.db.dispositivo.findFirst({
      where: { cuentaId: cuenta.id, proveedorDeviceId },
      select: { id: true },
    });
    if (!dispositivo) {
      throw new NotFoundException('El Dispositivo no pertenece a esta Cuenta.');
    }

    const operadorPrincipalId = await this.dispositivos.operadorPrincipalId(
      cuenta.empresaRevendedoraId,
    );
    this.logger.log(
      `El Portal de Cliente dio de baja el Dispositivo ${proveedorDeviceId} ` +
        `de la Cuenta ${proveedorCuentaId}.`,
    );
    return this.dispositivos.eliminarDefinitivamente(dispositivo.id, operadorPrincipalId);
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private async armarCuentaDto(
    cuenta: Cuenta & { dispositivos: Dispositivo[] },
    clienteId: string,
  ) {
    const credenciales = await this.cuentas.obtenerCredenciales(cuenta.id);
    const esExclusivaDelCliente =
      cuenta.esExclusiva && cuenta.clienteFinalExclusivoId === clienteId;

    // En una compartida el Cliente Final sólo ve los Dispositivos que la Empresa
    // Revendedora le asignó; en la exclusiva ve todos los de la Cuenta.
    const dispositivos = esExclusivaDelCliente
      ? cuenta.dispositivos
      : cuenta.dispositivos.filter((dispositivo) => dispositivo.clienteFinalId === clienteId);

    return {
      id: cuenta.id,
      proveedor_cuenta_id: cuenta.proveedorCuentaId,
      es_exclusiva: cuenta.esExclusiva,
      es_prueba: cuenta.esPrueba,
      prueba_vence_en: cuenta.esPrueba ? cuenta.pruebaVenceEn : null,
      aislada: cuenta.aislada,
      estado: cuenta.estado,
      usuario: credenciales.usuario,
      password: credenciales.password,
      pin: credenciales.pin,
      servicios: cuenta.servicios,
      servicios_nombres: nombresDeServicios(cuenta.servicios),
      puede_editar: cuenta.estado === 'activa',
      puede_cambiar_password: cuenta.estado === 'activa',
      requiere_confirmacion_cambio_compartida: !cuenta.esExclusiva,
      dispositivos: dispositivos.map((dispositivo) => this.mapDispositivo(dispositivo)),
    };
  }

  private mapDispositivo(dispositivo: Dispositivo) {
    return {
      id: dispositivo.id,
      proveedor_device_id: dispositivo.proveedorDeviceId,
      tipo: dispositivo.tipo,
      estado: dispositivo.estado,
      estado_vinculacion: dispositivo.estadoVinculacion,
      mac: dispositivo.mac,
      modelo: dispositivo.modelo,
      ultimo_inicio: dispositivo.ultimoInicio,
    };
  }

  private async buscarCliente(dni: string) {
    const empresaRevendedoraId = this.contexto.empresaRevendedoraId;
    if (!empresaRevendedoraId) {
      throw new ForbiddenException('El request no tiene una Empresa Revendedora asignada.');
    }

    const candidatos = await this.prisma.db.clienteFinal.findMany({
      where: { empresaRevendedoraId, dni: dni.trim() },
      orderBy: { creadoEn: 'asc' },
    });

    const cliente =
      candidatos.find(
        (candidato) =>
          candidato.estado === EstadoClienteFinal.activo ||
          candidato.estado === EstadoClienteFinal.suspendido,
      ) ?? candidatos[0];

    if (!cliente) {
      throw new NotFoundException('No encontramos un Cliente Final con ese DNI.');
    }
    return cliente;
  }

  /** Busca una Cuenta activa por su ID en el Proveedor (no por el UUID interno). */
  private async buscarCuentaActiva(proveedorCuentaId: string) {
    const cuenta = await this.buscarCuentaPorProveedor(proveedorCuentaId);
    if (cuenta.estado !== 'activa') {
      throw new ForbiddenException('La Cuenta no está activa.');
    }
    return cuenta;
  }

  private async buscarCuentaPorProveedor(proveedorCuentaId: string) {
    const cuenta = await this.prisma.db.cuenta.findFirst({
      where: { proveedorCuentaId },
    });
    if (!cuenta) {
      throw new NotFoundException('La Cuenta no existe o no está disponible.');
    }
    return cuenta;
  }

  private async cuentasDelCliente(clienteId: string) {
    const [exclusivas, porDispositivo, porVenta] = await Promise.all([
      this.prisma.db.cuenta.findMany({
        where: { clienteFinalExclusivoId: clienteId },
        select: { id: true },
      }),
      this.prisma.db.dispositivo.findMany({
        where: { clienteFinalId: clienteId },
        select: { cuentaId: true },
      }),
      this.prisma.db.ventaCompartida.findMany({
        where: { clienteFinalId: clienteId },
        select: { cuentaId: true },
      }),
    ]);

    const cuentaIds = [
      ...new Set<string>([
        ...exclusivas.map((cuenta) => cuenta.id),
        ...porDispositivo.map((dispositivo) => dispositivo.cuentaId),
        ...porVenta.map((venta) => venta.cuentaId),
      ]),
    ];

    return cuentaIds.length
      ? this.prisma.db.cuenta.findMany({
          where: { id: { in: cuentaIds } },
          include: { dispositivos: { orderBy: { creadoEn: 'asc' } } },
        })
      : [];
  }

  private async buscarClientePorGestion(idGestionExterno: string) {
    const empresaRevendedoraId = this.contexto.empresaRevendedoraId;
    if (!empresaRevendedoraId) {
      throw new ForbiddenException('El request no tiene una Empresa Revendedora asignada.');
    }

    const cliente = await this.prisma.db.clienteFinal.findFirst({
      where: {
        empresaRevendedoraId,
        idGestionExterno: idGestionExterno.trim(),
        estado: { in: [EstadoClienteFinal.activo, EstadoClienteFinal.suspendido] },
      },
      orderBy: { creadoEn: 'asc' },
    });
    if (!cliente) {
      throw new NotFoundException('No encontramos un Cliente Final con ese ID de gestión.');
    }
    return cliente;
  }

  private mapClienteResumen(cliente: {
    id: string;
    numeroCliente: number;
    nombre: string | null;
    apellido: string | null;
    dni: string | null;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
    idGestionExterno: string | null;
    estado: string;
    tipoAlta: string;
    creadoEn: Date;
  }) {
    return {
      id: cliente.id,
      numero_cliente: cliente.numeroCliente,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      nombre_completo: [cliente.nombre, cliente.apellido].filter(Boolean).join(' '),
      dni: cliente.dni,
      telefono: cliente.telefono,
      email: cliente.email,
      direccion: cliente.direccion,
      id_gestion_externo: cliente.idGestionExterno,
      estado: cliente.estado,
      tipo_alta: cliente.tipoAlta,
      creado_en: cliente.creadoEn,
    };
  }

  /** Resumen seguro del detalle que devuelven las transiciones del Cliente. */
  private mapDetalleResumen(cliente: {
    id: string;
    numero_cliente?: number;
    nombre?: string | null;
    apellido?: string | null;
    nombre_completo?: string;
    dni?: string | null;
    estado: string;
    tipo_alta?: string;
    creado_en?: Date;
  }) {
    return {
      id: cliente.id,
      numero_cliente: cliente.numero_cliente ?? null,
      nombre: cliente.nombre ?? null,
      apellido: cliente.apellido ?? null,
      nombre_completo:
        cliente.nombre_completo ??
        [cliente.nombre, cliente.apellido].filter(Boolean).join(' '),
      dni: cliente.dni ?? null,
      estado: cliente.estado,
      tipo_alta: cliente.tipo_alta ?? null,
      creado_en: cliente.creado_en ?? null,
    };
  }

  /**
   * Una cuenta compartida tiene credenciales compartidas: antes de cambiarlas
   * se exige confirmación explícita.
   */
  private exigirConfirmacionCompartida(
    cuenta: Cuenta,
    confirmada: boolean,
    operacion: string,
  ): void {
    if (cuenta.esExclusiva || confirmada) return;
    throw new ConflictException({
      statusCode: 409,
      error: 'SharedAccountConfirmationRequired',
      message:
        `Esta Cuenta es compartida: cambiar ${operacion} afecta a TODOS sus Clientes ` +
        'Finales. Reenviar el request con "confirmar_cambio_compartida": true para continuar.',
      cuenta_compartida: true,
    });
  }

  private respuestaEdicion(cuenta: Cuenta, resultado: object) {
    return {
      ...resultado,
      proveedor_cuenta_id: cuenta.proveedorCuentaId,
      cuenta_compartida: !cuenta.esExclusiva,
      advertencia: cuenta.esExclusiva
        ? null
        : 'El cambio aplica a todos los Clientes Finales de esta Cuenta compartida.',
    };
  }

  private async validarCuentaDelCliente(
    dni: string,
    cuentaId: string,
    opciones: { permitirCompartida: boolean },
  ) {
    const cliente = await this.buscarCliente(dni);

    const cuenta = await this.prisma.db.cuenta.findUnique({ where: { id: cuentaId } });
    if (!cuenta) throw new NotFoundException('La Cuenta no existe o no está disponible.');

    if (cuenta.empresaRevendedoraId !== cliente.empresaRevendedoraId) {
      throw new ForbiddenException('La Cuenta no pertenece a la Empresa del Cliente.');
    }

    if (cuenta.esExclusiva) {
      if (cuenta.clienteFinalExclusivoId !== cliente.id) {
        throw new ForbiddenException('La Cuenta no pertenece a este Cliente.');
      }
    } else {
      if (!opciones.permitirCompartida) {
        throw new ForbiddenException(
          'Esta Cuenta es compartida: el portal sólo permite consultar su información.',
        );
      }
      const pertenece = await this.clientePerteneceACuentaCompartida(cliente.id, cuentaId);
      if (!pertenece) {
        throw new ForbiddenException('La Cuenta no pertenece a este Cliente.');
      }
    }

    if (cuenta.estado !== 'activa') {
      throw new ForbiddenException('La Cuenta no está activa.');
    }

    return { cliente, cuenta };
  }

  /** Un cliente pertenece a una compartida por su venta o por un dispositivo. */
  private async clientePerteneceACuentaCompartida(
    clienteId: string,
    cuentaId: string,
  ): Promise<boolean> {
    const [venta, dispositivo] = await Promise.all([
      this.prisma.db.ventaCompartida.findUnique({
        where: { cuentaId_clienteFinalId: { cuentaId, clienteFinalId: clienteId } },
        select: { id: true },
      }),
      this.prisma.db.dispositivo.findFirst({
        where: { cuentaId, clienteFinalId: clienteId },
        select: { id: true },
      }),
    ]);
    return Boolean(venta || dispositivo);
  }
}
