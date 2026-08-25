import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AccionAuditoria,
  ClienteFinal,
  Cuenta,
  Dispositivo,
  EntidadAuditada,
  EstadoClienteFinal,
  EstadoDispositivo,
  EstadoSolicitudVinculacion,
  EstadoVinculacionDispositivo,
  Prisma,
  TipoAltaClienteFinal,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { ColaProveedorService } from '../../queues/cola-proveedor.service';
import { CuentasProvisioningService } from '../cuentas/cuentas-provisioning.service';
import { calcularCapacidad, contarDispositivosCliente } from '../cuentas/capacidad.util';
import { serviciosContratados } from '../../proveedor/servicios.util';

const DURACION_VINCULACION_MS = 10 * 60_000;
const INTERVALO_SONDEO_MS = 30_000;

export interface AltaDispositivoParams {
  clienteFinal: ClienteFinal;
  notaDescriptiva?: string;
  cuentaExclusiva?: boolean;
  cuentaIdForzada?: string;
  dispositivoIdForzado?: string;
  operadorPrincipalId: string;
  /** Firma canónica, por ejemplo `1|3|5`. */
  servicios: string;
}

export interface ResultadoAltaDispositivo {
  dispositivo: Dispositivo;
  cuenta: Cuenta;
  cuentaCreada: boolean;
  pendienteDeAutoprovision: boolean;
  solicitudVinculacionId: string;
}

@Injectable()
export class DispositivosService {
  private readonly logger = new Logger(DispositivosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly contexto: RequestContextService,
    private readonly proveedor: ProveedorService,
    private readonly provisioning: CuentasProvisioningService,
    private readonly cola: ColaProveedorService,
  ) {}

  async alta(params: AltaDispositivoParams): Promise<ResultadoAltaDispositivo> {
    const { clienteFinal, operadorPrincipalId } = params;
    const empresaRevendedora = await this.prisma.db.empresaRevendedora.findUniqueOrThrow({
      where: { id: clienteFinal.empresaRevendedoraId },
    });
    const umbral = await this.umbralAlerta(operadorPrincipalId);
    let cuentaCreada = false;
    let cuentaId = params.cuentaIdForzada ?? null;

    if (!cuentaId && !params.cuentaExclusiva) {
      cuentaId = await this.provisioning.buscarCuentaConLugar(
        empresaRevendedora.id,
        umbral,
        [],
        params.servicios,
      );
    }

    if (!cuentaId) {
      const cuentaNueva = await this.provisioning.crearCuenta({
        empresaRevendedora,
        clienteFinal,
        operadorPrincipalId,
        esExclusiva: Boolean(params.cuentaExclusiva),
        servicios: params.servicios,
      });
      cuentaId = cuentaNueva.id;
      cuentaCreada = true;
    }

    let cuenta: Cuenta;
    // Se sube el contador ANTES de abrir la ventana: SENSA rechaza el primer
    // inicio de sesión del Cliente Final nuevo si el contador todavía no
    // refleja su venta.
    let incrementoAplicado = false;
    if (params.dispositivoIdForzado) {
      // Reactivación o reasignación de un Dispositivo ya vinculado a la Cuenta:
      // el cupo comercial lo ocupa ese mismo Dispositivo, no se vuelve a contar.
      cuenta = await this.prisma.db.cuenta.findUniqueOrThrow({ where: { id: cuentaId } });
    } else {
      const cuentaConDispositivos = await this.prisma.db.cuenta.findUniqueOrThrow({
        where: { id: cuentaId },
        include: { dispositivos: { select: { tipo: true, estado: true, clienteFinalId: true } } },
      });
      const capacidad = calcularCapacidad(cuentaConDispositivos, umbral);

      if (cuentaConDispositivos.esExclusiva) {
        if (capacidad.completa) {
          throw new BadRequestException(
            'La Cuenta llegó al límite de 3 Dispositivos fijos y 3 móviles.',
          );
        }
      } else {
        const dispositivosDelCliente = contarDispositivosCliente(
          cuentaConDispositivos.dispositivos,
          clienteFinal.id,
        );
        if (dispositivosDelCliente > 0) {
          // Completa su venta actual: el 2do Dispositivo del par (1 fijo + 1 móvil).
          if (dispositivosDelCliente >= 2) {
            throw new BadRequestException(
              'Este Cliente Final ya tiene sus 2 Dispositivos (1 fijo + 1 móvil) en esta Cuenta.',
            );
          }
        } else {
          // Es una venta nueva: la Cuenta necesita lugar para otro Cliente Final.
          if (capacidad.completa) {
            throw new BadRequestException('La Cuenta llegó al límite de 3 ventas.');
          }
          if (!cuentaCreada) {
            await this.provisioning.incrementarCapacidadPorNuevaVenta(
              cuentaId,
              operadorPrincipalId,
            );
            incrementoAplicado = true;
          }
        }
      }
      cuenta = cuentaConDispositivos;
    }
    if (!cuenta.proveedorCuentaId) {
      throw new BadRequestException('La Cuenta todavía no fue confirmada por el Proveedor.');
    }

    const baseline = await this.proveedor.listarDispositivos(
      operadorPrincipalId,
      cuenta.proveedorCuentaId,
    );

    try {
      const ahora = new Date();
      const expiraEn = new Date(ahora.getTime() + DURACION_VINCULACION_MS);
      const proximoSondeoEn = new Date(ahora.getTime() + INTERVALO_SONDEO_MS);
      const resultado = await this.prisma.transaction(async (tx) => {
        const dispositivo = params.dispositivoIdForzado
          ? await tx.dispositivo.update({
              where: { id: params.dispositivoIdForzado },
              data: {
                clienteFinalId: clienteFinal.id,
                cuentaId: cuenta.id,
                estado: EstadoDispositivo.activo,
                estadoVinculacion: EstadoVinculacionDispositivo.observando,
                proveedorDeviceId: null,
                mac: null,
                tipo: null,
                tipoProveedor: null,
                notaDescriptiva: params.notaDescriptiva ?? null,
              },
            })
          : await tx.dispositivo.create({
              data: {
                cuentaId: cuenta.id,
                empresaRevendedoraId: empresaRevendedora.id,
                clienteFinalId: clienteFinal.id,
                tipo: null,
                estado: EstadoDispositivo.activo,
                estadoVinculacion: EstadoVinculacionDispositivo.observando,
                notaDescriptiva: params.notaDescriptiva ?? null,
              },
            });
        const solicitud = await tx.solicitudVinculacionDispositivo.create({
          data: {
            dispositivoId: dispositivo.id,
            cuentaId: cuenta.id,
            empresaRevendedoraId: empresaRevendedora.id,
            estado: EstadoSolicitudVinculacion.observando,
            baselineDeviceIds: baseline.map((item) => item.proveedorDeviceId),
            abiertaEn: ahora,
            expiraEn,
            proximoSondeoEn,
          },
        });
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.apertura_vinculacion_dispositivo,
          entidad: EntidadAuditada.SolicitudVinculacionDispositivo,
          entidadId: solicitud.id,
          empresaRevendedoraId: empresaRevendedora.id,
          detalle: {
            cuenta_id: cuenta.id,
            dispositivo_id: dispositivo.id,
            expira_en: expiraEn.toISOString(),
          },
        });
        return { dispositivo, solicitud };
      });

      await this.cola.encolarSondeoVinculacion({
        solicitudId: resultado.solicitud.id,
        operadorPrincipalId,
        intento: 1,
      });
      return {
        dispositivo: resultado.dispositivo,
        cuenta,
        cuentaCreada,
        pendienteDeAutoprovision: true,
        solicitudVinculacionId: resultado.solicitud.id,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // El índice único por Cuenta limita a una vinculación abierta a la vez:
        // es una colisión de altas concurrentes, no un fallo de SENSA.
        this.logger.warn(
          `Alta concurrente sobre la Cuenta ${cuenta.id}: ya existe una vinculación en curso.`,
        );
        throw new BadRequestException(
          'La Cuenta ya tiene una vinculación de Dispositivo en curso. Espere a que finalice antes de otra venta.',
        );
      }
      if (incrementoAplicado) {
        // El alta local falló después de subirle el contador a SENSA: se
        // recalcula contra la base real (sin el Dispositivo fallido) para que
        // el contador vuelva a bajar solo.
        await this.provisioning
          .sincronizarContadoresVenta(cuenta.id, operadorPrincipalId)
          .catch((cause) =>
            this.logger.error(
              `No se pudo revertir el contador de la Cuenta ${cuenta.id}: ${(cause as Error).message}`,
            ),
          );
      }
      throw error;
    }
  }

  /**
   * Corrige un Dispositivo que quedó vinculado al Cliente Final equivocado.
   *
   * Caso real: en una Cuenta compartida, mientras la ventana de vinculación de
   * un Cliente Final está abierta, OTRO Cliente Final de la misma Cuenta prueba
   * sus credenciales en un segundo equipo. SENSA no distingue de quién es cada
   * inicio de sesión, así que ese equipo ajeno puede terminar vinculado al
   * Cliente Final que en realidad todavía no iba a iniciar sesión.
   *
   * No hay forma automática de detectar esto (SENSA no identifica al dueño
   * físico del equipo): la corrección es siempre una decisión manual de la
   * Empresa Revendedora, típicamente después de que el cliente afectado
   * reporta que no ve contenido.
   *
   * En los dos casos, el Cliente Final que se queda sin Dispositivo recibe una
   * ventana de vinculación NUEVA para que, la próxima vez que inicie sesión de
   * verdad, el sistema lo detecte.
   */
  async corregirVinculacion(
    dispositivoId: string,
    operadorPrincipalId: string,
    opciones: { accion: 'reasignar' | 'eliminar'; clienteFinalDestinoId?: string },
  ): Promise<{ solicitudVinculacionId: string; clienteFinalAfectadoId: string }> {
    const dispositivo = await this.prisma.db.dispositivo.findUnique({
      where: { id: dispositivoId },
      include: { cuenta: true },
    });
    if (!dispositivo) throw new NotFoundException('El Dispositivo no existe.');
    if (
      dispositivo.estado !== EstadoDispositivo.activo ||
      dispositivo.estadoVinculacion !== EstadoVinculacionDispositivo.vinculado ||
      !dispositivo.proveedorDeviceId
    ) {
      throw new BadRequestException(
        'Sólo se puede corregir un Dispositivo activo y ya vinculado en el Proveedor.',
      );
    }
    const clienteOrigenId = dispositivo.clienteFinalId;
    if (!clienteOrigenId) {
      throw new BadRequestException('El Dispositivo no tiene un Cliente Final asociado.');
    }

    if (opciones.accion === 'eliminar') {
      await this.proveedor.eliminarDispositivo(operadorPrincipalId, dispositivo.proveedorDeviceId);
      await this.audit.registrar({
        accion: AccionAuditoria.correccion_vinculacion_dispositivo,
        entidad: EntidadAuditada.Dispositivo,
        entidadId: dispositivoId,
        empresaRevendedoraId: dispositivo.empresaRevendedoraId,
        detalle: {
          cuenta_id: dispositivo.cuentaId,
          resolucion: 'eliminado',
          cliente_afectado: clienteOrigenId,
        },
      });
      // Se reutiliza la misma fila: vuelve a quedar pendiente para el mismo
      // Cliente Final, ahora con una ventana nueva.
      const solicitud = await this.reabrirVentana(
        dispositivoId,
        dispositivo.cuenta,
        operadorPrincipalId,
      );
      return { solicitudVinculacionId: solicitud.id, clienteFinalAfectadoId: clienteOrigenId };
    }

    if (!opciones.clienteFinalDestinoId) {
      throw new BadRequestException(
        'Falta indicar a qué Cliente Final pertenece este Dispositivo.',
      );
    }
    if (opciones.clienteFinalDestinoId === clienteOrigenId) {
      throw new BadRequestException('Elija un Cliente Final distinto al que tiene asignado hoy.');
    }
    const destino = await this.prisma.db.clienteFinal.findUnique({
      where: { id: opciones.clienteFinalDestinoId },
    });
    if (!destino || destino.empresaRevendedoraId !== dispositivo.empresaRevendedoraId) {
      throw new BadRequestException(
        'El Cliente Final destino no pertenece a esta Empresa Revendedora.',
      );
    }
    if (destino.estado !== EstadoClienteFinal.activo) {
      throw new BadRequestException('Sólo se puede reasignar a un Cliente Final activo.');
    }

    await this.prisma.transaction(async (tx) => {
      await tx.dispositivo.update({
        where: { id: dispositivoId },
        data: { clienteFinalId: destino.id },
      });
      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.correccion_vinculacion_dispositivo,
        entidad: EntidadAuditada.Dispositivo,
        entidadId: dispositivoId,
        empresaRevendedoraId: dispositivo.empresaRevendedoraId,
        detalle: {
          cuenta_id: dispositivo.cuentaId,
          resolucion: 'reasignado',
          cliente_origen: clienteOrigenId,
          cliente_destino: destino.id,
        },
      });
    });

    // El cliente que se quedó sin equipo necesita una fila nueva y su propia
    // ventana: la que tenía se la quedó el destino.
    const nuevaFila = await this.prisma.db.dispositivo.create({
      data: {
        cuentaId: dispositivo.cuentaId,
        empresaRevendedoraId: dispositivo.empresaRevendedoraId,
        clienteFinalId: clienteOrigenId,
        tipo: null,
        estado: EstadoDispositivo.activo,
        estadoVinculacion: EstadoVinculacionDispositivo.pendiente,
      },
    });
    const solicitud = await this.reabrirVentana(
      nuevaFila.id,
      dispositivo.cuenta,
      operadorPrincipalId,
    );
    return { solicitudVinculacionId: solicitud.id, clienteFinalAfectadoId: clienteOrigenId };
  }

  /** Abre una ventana de vinculación nueva sobre un Dispositivo ya existente. */
  private async reabrirVentana(
    dispositivoId: string,
    cuenta: Pick<Cuenta, 'id' | 'proveedorCuentaId'>,
    operadorPrincipalId: string,
  ): Promise<{ id: string }> {
    if (!cuenta.proveedorCuentaId) {
      throw new BadRequestException('La Cuenta todavía no fue confirmada por el Proveedor.');
    }
    const baseline = await this.proveedor.listarDispositivos(
      operadorPrincipalId,
      cuenta.proveedorCuentaId,
    );
    const ahora = new Date();
    const expiraEn = new Date(ahora.getTime() + DURACION_VINCULACION_MS);
    const proximoSondeoEn = new Date(ahora.getTime() + INTERVALO_SONDEO_MS);

    const solicitud = await this.prisma.transaction(async (tx) => {
      await tx.solicitudVinculacionDispositivo.updateMany({
        where: {
          dispositivoId,
          estado: {
            in: [
              EstadoSolicitudVinculacion.pendiente,
              EstadoSolicitudVinculacion.observando,
              EstadoSolicitudVinculacion.ambiguo,
            ],
          },
        },
        data: { estado: EstadoSolicitudVinculacion.cancelado },
      });
      const dispositivo = await tx.dispositivo.update({
        where: { id: dispositivoId },
        data: {
          proveedorDeviceId: null,
          mac: null,
          tipo: null,
          tipoProveedor: null,
          estadoVinculacion: EstadoVinculacionDispositivo.observando,
        },
      });
      const nuevaSolicitud = await tx.solicitudVinculacionDispositivo.create({
        data: {
          dispositivoId: dispositivo.id,
          cuentaId: cuenta.id,
          empresaRevendedoraId: dispositivo.empresaRevendedoraId,
          estado: EstadoSolicitudVinculacion.observando,
          baselineDeviceIds: baseline.map((item) => item.proveedorDeviceId),
          abiertaEn: ahora,
          expiraEn,
          proximoSondeoEn,
        },
      });
      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.apertura_vinculacion_dispositivo,
        entidad: EntidadAuditada.SolicitudVinculacionDispositivo,
        entidadId: nuevaSolicitud.id,
        empresaRevendedoraId: dispositivo.empresaRevendedoraId,
        detalle: {
          cuenta_id: cuenta.id,
          dispositivo_id: dispositivo.id,
          expira_en: expiraEn.toISOString(),
          origen: 'correccion_vinculacion',
        },
      });
      return nuevaSolicitud;
    });

    await this.cola.encolarSondeoVinculacion({
      solicitudId: solicitud.id,
      operadorPrincipalId,
      intento: 1,
    });
    return solicitud;
  }

  async altaAdicional(
    clienteFinalId: string,
    opciones: { notaDescriptiva?: string; operadorPrincipalId: string },
  ): Promise<ResultadoAltaDispositivo & { migro: boolean }> {
    const clienteFinal = await this.prisma.db.clienteFinal.findUniqueOrThrow({
      where: { id: clienteFinalId },
      include: {
        // Se incluye también "disponible": si la ventana de vinculación de una
        // Cuenta exclusiva venció sin detectar equipo, el Dispositivo vuelve a
        // "disponible" pero sigue perteneciendo a este cliente (ver `liberar` y
        // el manejo de expiración en `ColaProveedorProcessor`) — sin esto, el
        // sistema "olvida" que el cliente ya tiene Cuenta y crea una nueva.
        dispositivos: {
          where: {
            estado: {
              in: [
                EstadoDispositivo.activo,
                EstadoDispositivo.bloqueado_por_suspension,
                EstadoDispositivo.disponible,
              ],
            },
          },
          include: { cuenta: true },
          orderBy: { creadoEn: 'asc' },
        },
      },
    });
    if (clienteFinal.estado !== EstadoClienteFinal.activo) {
      throw new BadRequestException('Sólo se pueden agregar Dispositivos a un cliente activo.');
    }

    const cuentaActual = clienteFinal.dispositivos[0]?.cuenta;
    if (cuentaActual) {
      const cuentaConDispositivos = await this.prisma.db.cuenta.findUniqueOrThrow({
        where: { id: cuentaActual.id },
        include: { dispositivos: { select: { tipo: true, estado: true, clienteFinalId: true } } },
      });
      const puedeQuedarseEnLaMismaCuenta = cuentaConDispositivos.esExclusiva
        ? !calcularCapacidad(cuentaConDispositivos).completa
        : contarDispositivosCliente(cuentaConDispositivos.dispositivos, clienteFinal.id) < 2;

      if (puedeQuedarseEnLaMismaCuenta) {
        const resultado = await this.alta({
          clienteFinal,
          notaDescriptiva: opciones.notaDescriptiva,
          cuentaIdForzada: cuentaActual.id,
          operadorPrincipalId: opciones.operadorPrincipalId,
          servicios: cuentaActual.servicios,
        });
        return { ...resultado, migro: false };
      }
      // Cuenta en el tope para este cliente: se cae al flujo general que busca
      // otra Cuenta compatible o crea una nueva (reglas 2.2 y 4.4). En una
      // Cuenta compartida esto es siempre una venta nueva (otra firma de
      // servicios o el cliente ya completó su par en ésta).
    }

    // Nunca debería llegar acá para un cliente `cuenta_exclusiva` que ya tiene
    // Cuenta (la búsqueda de arriba ya la encuentra); pero si de última pasa
    // (dato corrupto, Cuenta cerrada, etc.), no hay que degradarlo a una venta
    // compartida con servicio básico: hay que respetar su tipo de alta real.
    const esExclusivaPorTipoAlta = clienteFinal.tipoAlta === TipoAltaClienteFinal.cuenta_exclusiva;
    let servicios = cuentaActual?.servicios;
    if (!servicios) {
      servicios = esExclusivaPorTipoAlta
        ? serviciosContratados(
            await this.proveedor.consultarLicencias(opciones.operadorPrincipalId),
          )
        : '1';
    }

    const resultado = await this.alta({
      clienteFinal,
      notaDescriptiva: opciones.notaDescriptiva,
      cuentaExclusiva: !cuentaActual && esExclusivaPorTipoAlta,
      operadorPrincipalId: opciones.operadorPrincipalId,
      servicios,
    });
    return {
      ...resultado,
      migro: Boolean(cuentaActual && resultado.cuenta.id !== cuentaActual.id),
    };
  }

  async liberar(
    dispositivoId: string,
    estadoFinal: 'disponible' | 'bloqueado_por_suspension',
    operadorPrincipalId: string,
    motivo: AccionAuditoria,
  ): Promise<Dispositivo> {
    const dispositivo = await this.prisma.db.dispositivo.findUnique({
      where: { id: dispositivoId },
      include: { cuenta: true },
    });
    if (!dispositivo) throw new NotFoundException('El Dispositivo no existe.');

    if (dispositivo.proveedorDeviceId) {
      await this.proveedor.eliminarDispositivo(operadorPrincipalId, dispositivo.proveedorDeviceId);
    }
    const actualizado = await this.prisma.transaction(async (tx) => {
      await tx.solicitudVinculacionDispositivo.updateMany({
        where: {
          dispositivoId,
          estado: {
            in: [EstadoSolicitudVinculacion.pendiente, EstadoSolicitudVinculacion.observando],
          },
        },
        data: { estado: EstadoSolicitudVinculacion.cancelado },
      });
      // Una Cuenta exclusiva pertenece siempre al mismo Cliente Final: si sólo
      // se da de baja UN Dispositivo suyo (no el cliente completo), no hay que
      // "olvidar" el vínculo — si no, el sistema pierde de vista que la Cuenta
      // ya tiene dueño y termina creando una Cuenta nueva en el próximo alta
      // (caso real: Usuario 131, 24/08/2026). Sólo se limpia el vínculo cuando
      // el cliente se va por completo (`baja_cliente`) o la Cuenta es
      // compartida (ahí sí, el cupo queda libre para cualquier venta futura).
      const preservarCliente =
        estadoFinal === EstadoDispositivo.disponible &&
        dispositivo.cuenta.esExclusiva &&
        motivo !== AccionAuditoria.baja_cliente;
      const resultado = await tx.dispositivo.update({
        where: { id: dispositivoId },
        data: {
          estado: estadoFinal,
          estadoVinculacion: EstadoVinculacionDispositivo.cancelado,
          proveedorDeviceId: null,
          clienteFinalId:
            estadoFinal === EstadoDispositivo.disponible && !preservarCliente
              ? null
              : dispositivo.clienteFinalId,
        },
      });
      await this.audit.registrarEnTx(tx, {
        accion: motivo,
        entidad: EntidadAuditada.Dispositivo,
        entidadId: dispositivoId,
        empresaRevendedoraId: dispositivo.empresaRevendedoraId,
        detalle: { cuenta_id: dispositivo.cuentaId, estado_final: estadoFinal },
      });
      return resultado;
    });

    if (!dispositivo.cuenta.esExclusiva) {
      try {
        await this.provisioning.sincronizarContadoresVenta(
          dispositivo.cuentaId,
          operadorPrincipalId,
        );
      } catch (error) {
        this.logger.warn(
          `No se pudo sincronizar los contadores de la Cuenta ${dispositivo.cuentaId} tras liberar ` +
            `el Dispositivo ${dispositivoId}: ${(error as Error).message}. Se encola un reintento.`,
        );
        await this.cola.encolarSincronizacionContadoresVenta({
          cuentaId: dispositivo.cuentaId,
          operadorPrincipalId,
        });
      }
    }
    return actualizado;
  }

  async bajaIndividual(dispositivoId: string, operadorPrincipalId: string): Promise<Dispositivo> {
    const dispositivo = await this.prisma.db.dispositivo.findUnique({
      where: { id: dispositivoId },
    });
    if (!dispositivo) throw new NotFoundException('El Dispositivo no existe.');
    if (dispositivo.estado === EstadoDispositivo.bloqueado_por_suspension) {
      throw new BadRequestException(
        'El Dispositivo está bloqueado por suspensión y no puede reasignarse.',
      );
    }
    return this.liberar(
      dispositivoId,
      EstadoDispositivo.disponible,
      operadorPrincipalId,
      AccionAuditoria.baja_dispositivo,
    );
  }

  async actualizarNota(dispositivoId: string, nota: string | null): Promise<Dispositivo> {
    return this.prisma.db.dispositivo.update({
      where: { id: dispositivoId },
      data: { notaDescriptiva: nota },
    });
  }

  async reasignar(
    dispositivoId: string,
    clienteFinalId: string,
    operadorPrincipalId: string,
    opciones?: { notaDescriptiva?: string },
  ): Promise<ResultadoAltaDispositivo> {
    const dispositivo = await this.prisma.db.dispositivo.findUnique({
      where: { id: dispositivoId },
      include: { cuenta: true },
    });
    if (!dispositivo) throw new NotFoundException('El Dispositivo no existe.');
    if (
      dispositivo.estado !== EstadoDispositivo.disponible &&
      dispositivo.estado !== EstadoDispositivo.bloqueado_por_suspension
    ) {
      throw new BadRequestException('Sólo se pueden reactivar o reasignar Dispositivos liberados.');
    }
    const clienteFinal = await this.prisma.db.clienteFinal.findUniqueOrThrow({
      where: { id: clienteFinalId },
    });
    const resultado = await this.alta({
      clienteFinal,
      notaDescriptiva: opciones?.notaDescriptiva,
      cuentaIdForzada: dispositivo.cuentaId,
      dispositivoIdForzado: dispositivo.id,
      operadorPrincipalId,
      servicios: dispositivo.cuenta.servicios,
    });
    await this.audit.registrar({
      accion: AccionAuditoria.reasignacion_dispositivo,
      entidad: EntidadAuditada.Dispositivo,
      entidadId: resultado.dispositivo.id,
      empresaRevendedoraId: dispositivo.empresaRevendedoraId,
      detalle: { cliente_final_id: clienteFinalId, cuenta_id: dispositivo.cuentaId },
    });
    return resultado;
  }

  private async umbralAlerta(operadorPrincipalId: string): Promise<number> {
    const operador = await this.prisma.operadorPrincipal.findUnique({
      where: { id: operadorPrincipalId },
      select: { umbralAlertaCapacidad: true },
    });
    return operador?.umbralAlertaCapacidad ?? 2;
  }

  async operadorPrincipalId(empresaRevendedoraId?: string): Promise<string> {
    const desdeContexto = this.contexto.operadorPrincipalId;
    if (desdeContexto) return desdeContexto;
    if (!empresaRevendedoraId) {
      throw new BadRequestException('No se pudo determinar el Operador Principal del request.');
    }
    const empresa = await this.prisma.empresaRevendedora.findUniqueOrThrow({
      where: { id: empresaRevendedoraId },
      select: { operadorPrincipalId: true },
    });
    return empresa.operadorPrincipalId;
  }
}
