import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Cuenta,
  Dispositivo,
  EstadoClienteFinal,
  EstadoIncidenciaDispositivo,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { CuentasService } from '../cuentas/cuentas.service';
import { InventarioProveedorService } from '../cuentas/inventario-proveedor.service';
import { nombresDeServicios } from '../cuentas/cuentas.mapper';
import { DispositivosService } from '../dispositivos/dispositivos.service';
import { IncidenciasDispositivosService } from '../dispositivos/incidencias-dispositivos.service';

/**
 * =============================================================================
 * Portal de Cliente externo
 * =============================================================================
 * El Cliente Final (identificado por DNI) consulta sus credenciales, servicios y
 * dispositivos. En CUENTAS EXCLUSIVAS puede además editar contraseña, PIN,
 * servicios y administrar sus dispositivos; en COMPARTIDAS es sólo lectura.
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
    private readonly inventario: InventarioProveedorService,
    private readonly dispositivos: DispositivosService,
    private readonly incidencias: IncidenciasDispositivosService,
  ) {}

  /** Datos del cliente, sus cuentas, credenciales, servicios y dispositivos. */
  async sesion(dni: string) {
    const cliente = await this.buscarCliente(dni);

    const [exclusivas, porDispositivo, porVenta] = await Promise.all([
      this.prisma.db.cuenta.findMany({
        where: { clienteFinalExclusivoId: cliente.id },
        select: { id: true },
      }),
      this.prisma.db.dispositivo.findMany({
        where: { clienteFinalId: cliente.id },
        select: { cuentaId: true },
      }),
      this.prisma.db.ventaCompartida.findMany({
        where: { clienteFinalId: cliente.id },
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

    const cuentas = cuentaIds.length
      ? await this.prisma.db.cuenta.findMany({
          where: { id: { in: cuentaIds } },
          include: { dispositivos: { orderBy: { creadoEn: 'asc' } } },
        })
      : [];

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

  /** Cambia la contraseña de una cuenta exclusiva del cliente. */
  async cambiarPassword(dni: string, cuentaId: string, password: string) {
    await this.validarCuentaExclusiva(dni, cuentaId);
    return this.cuentas.cambiarPassword(cuentaId, password);
  }

  /** Cambia el PIN de una cuenta exclusiva del cliente. */
  async cambiarPin(dni: string, cuentaId: string, pin: string) {
    await this.validarCuentaExclusiva(dni, cuentaId);
    return this.cuentas.cambiarPin(cuentaId, pin);
  }

  /** Cambia los servicios de una cuenta exclusiva (validados contra lo contratado). */
  async cambiarServicios(dni: string, cuentaId: string, servicios: string[]) {
    await this.validarCuentaExclusiva(dni, cuentaId);
    return this.cuentas.actualizarPropiedades(cuentaId, { servicios });
  }

  /** Inventario completo del proveedor para una cuenta exclusiva. */
  async sincronizarDispositivos(dni: string, cuentaId: string) {
    await this.validarCuentaExclusiva(dni, cuentaId);
    return this.inventario.sincronizar(cuentaId);
  }

  /**
   * Asigna al titular un Dispositivo detectado en el proveedor pero todavía sin
   * dueño (incidencia pendiente). Mismo camino que "Vincular" del panel.
   */
  async reclamarDispositivo(dni: string, cuentaId: string, proveedorDeviceId: string) {
    const { cliente } = await this.validarCuentaExclusiva(dni, cuentaId);

    const incidencia = await this.prisma.db.incidenciaDispositivoProveedor.findFirst({
      where: {
        cuentaId,
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
   * Baja definitiva de un Dispositivo propio: lo elimina en el proveedor y borra
   * la fila local. Irreversible. Queda auditado por `DispositivosService`.
   */
  async darDeBajaDispositivo(dni: string, cuentaId: string, dispositivoId: string) {
    const { cuenta } = await this.validarCuentaExclusiva(dni, cuentaId);

    const dispositivo = await this.prisma.db.dispositivo.findUnique({
      where: { id: dispositivoId },
      select: { id: true, cuentaId: true },
    });
    if (!dispositivo || dispositivo.cuentaId !== cuenta.id) {
      throw new NotFoundException('El Dispositivo no pertenece a esta Cuenta.');
    }

    const operadorPrincipalId = await this.dispositivos.operadorPrincipalId(
      cuenta.empresaRevendedoraId,
    );
    this.logger.log(
      `El Portal de Cliente dio de baja el Dispositivo ${dispositivoId} de la Cuenta ${cuentaId}.`,
    );
    return this.dispositivos.eliminarDefinitivamente(dispositivoId, operadorPrincipalId);
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
      puede_editar: esExclusivaDelCliente && cuenta.estado === 'activa',
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

  /**
   * Verifica que la Cuenta sea exclusiva y del cliente del DNI. Cualquier
   * escritura pasa por acá, así nadie puede operar sobre la cuenta de otro
   * pasando un `cuentaId` ajeno.
   */
  private async validarCuentaExclusiva(dni: string, cuentaId: string) {
    const cliente = await this.buscarCliente(dni);

    const cuenta = await this.prisma.db.cuenta.findUnique({ where: { id: cuentaId } });
    if (!cuenta) throw new NotFoundException('La Cuenta no existe o no está disponible.');

    if (cuenta.empresaRevendedoraId !== cliente.empresaRevendedoraId) {
      throw new ForbiddenException('La Cuenta no pertenece a la Empresa del Cliente.');
    }
    if (!cuenta.esExclusiva) {
      throw new ForbiddenException(
        'Esta Cuenta es compartida: el portal sólo permite consultar su información.',
      );
    }
    if (cuenta.clienteFinalExclusivoId !== cliente.id) {
      throw new ForbiddenException('La Cuenta no pertenece a este Cliente.');
    }
    if (cuenta.estado !== 'activa') {
      throw new ForbiddenException('La Cuenta no está activa.');
    }

    return { cliente, cuenta };
  }
}
