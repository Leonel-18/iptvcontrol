import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  AccionAuditoria,
  EntidadAuditada,
  EstadoClienteFinal,
  EstadoCuenta,
  EstadoDispositivo,
  EstadoIncidenciaDispositivo,
  EstadoSolicitudVinculacion,
  EstadoVinculacionDispositivo,
  TipoDispositivo,
} from '@prisma/client';
import { Job } from 'bullmq';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService, TransactionClient } from '../common/prisma/prisma.service';
import { ProveedorService } from '../proveedor/proveedor.service';
import { CuentasProvisioningService } from '../modules/cuentas/cuentas-provisioning.service';
import { NotificacionesService } from '../modules/notificaciones/notificaciones.service';
import {
  COLA_PROVEEDOR,
  DatosCerrarCuenta,
  DatosEliminarDispositivo,
  DatosReconciliarDispositivos,
  DatosSondearVinculacion,
  DatosSincronizarContadoresVenta,
  TRABAJOS_PROVEEDOR,
} from './cola-proveedor.constants';
import { ColaProveedorService } from './cola-proveedor.service';

/**
 * Worker de las operaciones pendientes contra el Proveedor.
 *
 * Todos los trabajos son **idempotentes**: se recalcula el estado deseado a
 * partir de la base local y se lo empuja al Proveedor. Si el trabajo corre dos
 * veces, el resultado es el mismo. Eso es lo que hace seguro reintentar.
 *
 * Los jobs corren fuera de un request HTTP, así que no hay contexto de tenant:
 * se usa `transactionComoOperador`, que fija explícitamente el Operador
 * Principal dueño de la operación para que Row-Level Security siga aplicando.
 */
@Processor(COLA_PROVEEDOR)
export class ColaProveedorProcessor extends WorkerHost {
  private readonly logger = new Logger(ColaProveedorProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly proveedor: ProveedorService,
    private readonly audit: AuditService,
    private readonly cola: ColaProveedorService,
    private readonly provisioning: CuentasProvisioningService,
    private readonly notificaciones: NotificacionesService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case TRABAJOS_PROVEEDOR.ELIMINAR_DISPOSITIVO:
        return this.eliminarDispositivo(job.data as DatosEliminarDispositivo);
      case TRABAJOS_PROVEEDOR.RECONCILIAR_DISPOSITIVOS:
        return this.reconciliarDispositivos(job.data as DatosReconciliarDispositivos);
      case TRABAJOS_PROVEEDOR.SONDEAR_VINCULACION:
        return this.sondearVinculacion(job.data as DatosSondearVinculacion);
      case TRABAJOS_PROVEEDOR.BARRER_VINCULACIONES:
        return this.barrerVinculaciones();
      case TRABAJOS_PROVEEDOR.SINCRONIZAR_CONTADORES_VENTA:
        return this.sincronizarContadoresVenta(job.data as DatosSincronizarContadoresVenta);
      case TRABAJOS_PROVEEDOR.BARRER_INVENTARIO_CUENTAS:
        return this.barrerInventarioCuentas();
      case TRABAJOS_PROVEEDOR.CERRAR_CUENTA:
        return this.cerrarCuenta(job.data as DatosCerrarCuenta);
      case TRABAJOS_PROVEEDOR.BARRER_AISLAMIENTOS:
        return this.barrerAislamientos();
      case TRABAJOS_PROVEEDOR.BARRER_PRUEBAS_VENCIDAS:
        return this.barrerPruebasVencidas();
      case TRABAJOS_PROVEEDOR.BARRER_PRUEBAS_POR_VENCER:
        return this.barrerPruebasPorVencer();
      case TRABAJOS_PROVEEDOR.BARRER_VENTANAS_POR_VENCER:
        return this.barrerVentanasPorVencer();
      case TRABAJOS_PROVEEDOR.BARRER_RECORDATORIOS_DISPOSITIVOS:
        return this.barrerRecordatoriosDispositivos();
      default:
        this.logger.warn(`Trabajo desconocido en la cola: ${job.name}`);
        return null;
    }
  }

  /** Reintenta sincronizar los contadores de cupos comprometidos de una Cuenta compartida. */
  private async sincronizarContadoresVenta(
    datos: DatosSincronizarContadoresVenta,
  ): Promise<unknown> {
    await this.provisioning.sincronizarContadoresVenta(datos.cuentaId, datos.operadorPrincipalId);
    return { sincronizado: true };
  }

  private async eliminarDispositivo(datos: DatosEliminarDispositivo): Promise<unknown> {
    await this.proveedor.eliminarDispositivo(datos.operadorPrincipalId, datos.proveedorDeviceId);

    if (datos.dispositivoId) {
      await this.prisma.transactionComoOperador(datos.operadorPrincipalId, async (tx) => {
        await tx.dispositivo.updateMany({
          where: { id: datos.dispositivoId, proveedorDeviceId: datos.proveedorDeviceId },
          data: { proveedorDeviceId: null },
        });
      });
    }

    return { eliminado: true };
  }

  /**
   * Captura los `device_id` de los dispositivos que se auto-provisionaron.
   *
   * Necesario porque la API del Proveedor no tiene webhooks: cuando el alta se
   * hace sin MAC, el dispositivo aparece recién cuando el Cliente Final inicia
   * sesión, y la única forma de enterarse es preguntar.
   */
  private async reconciliarDispositivos(datos: DatosReconciliarDispositivos): Promise<unknown> {
    const cuenta = await this.prisma.transactionComoOperador(datos.operadorPrincipalId, (tx) =>
      tx.cuenta.findUnique({
        where: { id: datos.cuentaId },
        include: {
          dispositivos: {
            where: { estado: EstadoDispositivo.activo, proveedorDeviceId: null },
          },
        },
      }),
    );

    if (!cuenta?.proveedorCuentaId || cuenta.dispositivos.length === 0) {
      return { reconciliados: 0 };
    }

    const enProveedor = await this.proveedor.listarDispositivos(
      datos.operadorPrincipalId,
      cuenta.proveedorCuentaId,
    );

    const yaConocidos = await this.prisma.transactionComoOperador(datos.operadorPrincipalId, (tx) =>
      tx.dispositivo.findMany({
        where: { cuentaId: cuenta.id, proveedorDeviceId: { not: null } },
        select: { proveedorDeviceId: true },
      }),
    );
    const conocidos = new Set(yaConocidos.map((d) => d.proveedorDeviceId));
    const sinAsignar = enProveedor.filter((d) => !conocidos.has(d.proveedorDeviceId));

    let reconciliados = 0;
    for (const pendiente of cuenta.dispositivos) {
      // Se busca primero por MAC (match exacto) y si no hay, por tipo.
      const indice = pendiente.mac
        ? sinAsignar.findIndex((d) => d.mac?.toUpperCase() === pendiente.mac?.toUpperCase())
        : pendiente.tipo
          ? sinAsignar.findIndex((d) => this.coincideTipo(d.tipo, pendiente.tipo!))
          : sinAsignar.length === 1
            ? 0
            : -1;

      if (indice < 0) continue;

      const [encontrado] = sinAsignar.splice(indice, 1);
      await this.prisma.transactionComoOperador(datos.operadorPrincipalId, async (tx) => {
        await tx.dispositivo.update({
          where: { id: pendiente.id },
          data: {
            proveedorDeviceId: encontrado.proveedorDeviceId,
            mac: encontrado.mac ?? pendiente.mac,
          },
        });
      });
      reconciliados += 1;
    }

    if (reconciliados > 0) {
      this.logger.log(
        `Reconciliados ${reconciliados} dispositivos de la Cuenta ${cuenta.id} con el Proveedor.`,
      );
    }
    return { reconciliados };
  }

  private async sondearVinculacion(datos: DatosSondearVinculacion): Promise<unknown> {
    const solicitud = await this.prisma.transactionComoOperador(datos.operadorPrincipalId, (tx) =>
      tx.solicitudVinculacionDispositivo.findUnique({
        where: { id: datos.solicitudId },
        include: { cuenta: true, dispositivo: true },
      }),
    );
    if (
      !solicitud ||
      (solicitud.estado !== EstadoSolicitudVinculacion.pendiente &&
        solicitud.estado !== EstadoSolicitudVinculacion.observando)
    ) {
      return { activa: false };
    }

    const ahora = new Date();
    if (ahora >= solicitud.expiraEn) {
      // Si esta fila puntual ya detectó su equipo antes de que venza la
      // ventana (ej. un fijo de una venta compartida, o alguno de los hasta 3
      // fijos/3 móviles de una Cuenta exclusiva), la venta quedó cumplida
      // igual: lo que expira es sólo la búsqueda de un candidato adicional.
      // En una venta compartida SIN fila previa (Pieza 4) todavía no hay
      // Dispositivo: nunca pudo estar "ya vinculado".
      const equipoYaVinculado =
        solicitud.dispositivoId !== null &&
        solicitud.dispositivo?.estadoVinculacion === EstadoVinculacionDispositivo.vinculado;
      await this.prisma.transactionComoOperador(datos.operadorPrincipalId, async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${solicitud.cuentaId}))`;
        if (equipoYaVinculado) {
          await tx.solicitudVinculacionDispositivo.update({
            where: { id: solicitud.id },
            data: { estado: EstadoSolicitudVinculacion.vinculado, ultimoSondeoEn: ahora },
          });
          return;
        }

        // Sin equipo detectado: el Dispositivo nunca se materializó.
        if (solicitud.cuenta.esExclusiva) {
          // La Cuenta es de este Cliente Final igual, sólo tardó más de 10
          // minutos en conectar el equipo: se conserva la fila (liberada,
          // pero SIN perder el vínculo) para que el próximo alta la
          // encuentre en vez de crear una Cuenta nueva (caso real: Usuario
          // 131, 24/08/2026).
          await tx.solicitudVinculacionDispositivo.update({
            where: { id: solicitud.id },
            data: { estado: EstadoSolicitudVinculacion.expirado, ultimoSondeoEn: ahora },
          });
          if (solicitud.dispositivoId) {
            await tx.dispositivo.update({
              where: { id: solicitud.dispositivoId },
              data: {
                estado: EstadoDispositivo.disponible,
                estadoVinculacion: EstadoVinculacionDispositivo.expirado,
                clienteFinalId: solicitud.dispositivo?.clienteFinalId,
              },
            });
          }
        } else {
          // Cuenta compartida. Decisión de negocio (Fase F): expirar una
          // vinculación SIN equipos detectados NO cancela la venta 1+1/2+2.
          // La venta queda reservada (comercialmente y en los contadores de
          // SENSA) para que ese Cliente Final pueda cargar sus Dispositivos más
          // adelante; la Ventana de Alta vence por su propia duración. Se
          // expira la Solicitud; si hubo una fila previa (alta adicional o
          // flujos legados) se borra porque nunca representó un equipo real.
          await tx.solicitudVinculacionDispositivo.update({
            where: { id: solicitud.id },
            data: { estado: EstadoSolicitudVinculacion.expirado, ultimoSondeoEn: ahora },
          });
          if (solicitud.dispositivoId) {
            await tx.dispositivo.delete({ where: { id: solicitud.dispositivoId } });
          }
        }
      });
      if (!equipoYaVinculado && !solicitud.cuenta.esExclusiva) {
        // Tras expirar sin equipos, la venta compartida sigue reservada: se
        // re-sincroniza el contador contra las ventas reales para dejar el
        // valor consistente (si la venta se conservó, el contador no baja).
        await this.provisioning
          .sincronizarContadoresVenta(solicitud.cuentaId, datos.operadorPrincipalId)
          .catch(async (error) => {
            this.logger.error(
              `No se pudo re-sincronizar el contador de la Cuenta ${solicitud.cuentaId} tras expirar ` +
                `la vinculación: ${(error as Error).message}`,
            );
            await this.cola.encolarSincronizacionContadoresVenta({
              cuentaId: solicitud.cuentaId,
              operadorPrincipalId: datos.operadorPrincipalId,
            });
          });
      }
      return { activa: false, expirada: true };
    }

    if (!solicitud.cuenta.proveedorCuentaId) return { activa: false };
    const inventario = await this.proveedor.listarDispositivos(
      datos.operadorPrincipalId,
      solicitud.cuenta.proveedorCuentaId,
    );
    const baseline = new Set(
      Array.isArray(solicitud.baselineDeviceIds)
        ? solicitud.baselineDeviceIds.filter((id): id is string => typeof id === 'string')
        : [],
    );
    const idsVinculados = await this.prisma.transactionComoOperador(
      datos.operadorPrincipalId,
      (tx) =>
        tx.dispositivo.findMany({
          where: { cuentaId: solicitud.cuentaId, proveedorDeviceId: { not: null } },
          select: { proveedorDeviceId: true },
        }),
    );
    const conocidos = new Set(idsVinculados.map((item) => item.proveedorDeviceId));
    const candidatos = inventario.filter(
      (item) => !baseline.has(item.proveedorDeviceId) && !conocidos.has(item.proveedorDeviceId),
    );

    if (candidatos.length > 0) {
      return this.vincularCandidatos(
        solicitud,
        candidatos,
        datos.operadorPrincipalId,
        ahora,
        datos.intento,
      );
    }

    const proximoSondeoEn = new Date(ahora.getTime() + 30_000);
    await this.prisma.transactionComoOperador(datos.operadorPrincipalId, (tx) =>
      tx.solicitudVinculacionDispositivo.update({
        where: { id: solicitud.id },
        data: {
          ultimoSondeoEn: ahora,
          proximoSondeoEn,
          cantidadIntentos: { increment: 1 },
        },
      }),
    );
    await this.cola.encolarSondeoVinculacion({
      ...datos,
      intento: datos.intento + 1,
    });
    return { activa: true, candidatos: 0 };
  }

  private async barrerVinculaciones(): Promise<{ encoladas: number }> {
    const operadores = await this.prisma.operadorPrincipal.findMany({ select: { id: true } });
    let encoladas = 0;
    for (const operador of operadores) {
      const pendientes = await this.prisma.transactionComoOperador(operador.id, (tx) =>
        tx.solicitudVinculacionDispositivo.findMany({
          where: {
            estado: {
              in: [EstadoSolicitudVinculacion.pendiente, EstadoSolicitudVinculacion.observando],
            },
            proximoSondeoEn: { lte: new Date() },
          },
          select: { id: true, cantidadIntentos: true },
          orderBy: { proximoSondeoEn: 'asc' },
          take: 50,
        }),
      );
      for (const solicitud of pendientes) {
        await this.cola.encolarSondeoVinculacion({
          solicitudId: solicitud.id,
          operadorPrincipalId: operador.id,
          intento: solicitud.cantidadIntentos + 1,
        });
        encoladas += 1;
      }
    }
    return { encoladas };
  }

  /**
   * Barrido periódico best-effort: revisa un lote al azar de Cuentas activas
   * por Operador Principal para detectar Dispositivos que se auto-provisionaron
   * por fuera de una venta (ej. alguien reutiliza las credenciales compartidas
   * en el reproductor web de SENSA semanas después de la venta original). No
   * depende de que la Empresa Revendedora abra el botón de sincronización
   * manual del panel — eso sigue disponible para una revisión inmediata.
   *
   * Con el tope de 60 llamadas/minuto de SENSA y un lote chico por corrida, el
   * costo es bajo y, con el tiempo, cubre todas las Cuentas de forma rotativa.
   */
  private async barrerInventarioCuentas(): Promise<{
    cuentasRevisadas: number;
    incidenciasNuevas: number;
  }> {
    const LOTE_POR_OPERADOR = 15;
    const operadores = await this.prisma.operadorPrincipal.findMany({ select: { id: true } });

    let cuentasRevisadas = 0;
    let incidenciasNuevas = 0;

    for (const operador of operadores) {
      const cuentas = await this.prisma.transactionComoOperador(
        operador.id,
        (tx) =>
          tx.$queryRaw<
            { id: string; empresa_revendedora_id: string; proveedor_cuenta_id: string }[]
          >`
          SELECT "id", "empresa_revendedora_id", "proveedor_cuenta_id"
            FROM "cuenta"
           WHERE "estado" = 'activa' AND "proveedor_cuenta_id" IS NOT NULL
           ORDER BY RANDOM()
           LIMIT ${LOTE_POR_OPERADOR}
        `,
      );

      for (const cuenta of cuentas) {
        try {
          const detectadas = await this.sincronizarInventarioCuenta(
            cuenta.id,
            cuenta.empresa_revendedora_id,
            cuenta.proveedor_cuenta_id,
            operador.id,
          );
          cuentasRevisadas += 1;
          incidenciasNuevas += detectadas;
        } catch (error) {
          this.logger.error(
            `No se pudo sincronizar el inventario de la Cuenta ${cuenta.id}: ${(error as Error).message}`,
          );
        }
      }
    }

    if (incidenciasNuevas > 0) {
      this.logger.warn(
        `Barrido de inventario: ${incidenciasNuevas} Dispositivo(s) no autorizados detectados ` +
          `en ${cuentasRevisadas} Cuenta(s) revisadas.`,
      );
    }
    return { cuentasRevisadas, incidenciasNuevas };
  }

  /**
   * Cierra los aislamientos de Cuenta vencidos (HU-A03): devuelve la Cuenta a
   * `Compartida`, sin crear ni restaurar una Ventana de Alta. Idempotente: sólo
   * actualiza las Cuentas que siguen aisladas y vencidas, y audita como acción
   * del sistema (sin Team Member, por eso el `detalle.origen = 'automatico'`).
   */
  private async barrerAislamientos(): Promise<{ cerrados: number }> {
    const operadores = await this.prisma.operadorPrincipal.findMany({ select: { id: true } });
    let cerrados = 0;

    for (const operador of operadores) {
      const vencidas = await this.prisma.transactionComoOperador(operador.id, (tx) =>
        tx.cuenta.findMany({
          where: { aislada: true, aislamientoFinEn: { lte: new Date() } },
          select: { id: true, empresaRevendedoraId: true },
        }),
      );

      for (const cuenta of vencidas) {
        await this.prisma.transactionComoOperador(operador.id, async (tx) => {
          // Actualización condicional: si otra corrida ya lo cerró, no se repite
          // el efecto ni la auditoría.
          const actualizadas = await tx.cuenta.updateMany({
            where: { id: cuenta.id, aislada: true, aislamientoFinEn: { lte: new Date() } },
            data: { aislada: false, aislamientoFinEn: null },
          });
          if (actualizadas.count !== 1) return;

          await this.audit.registrarEnTx(tx, {
            accion: AccionAuditoria.fin_aislamiento_cuenta,
            entidad: EntidadAuditada.Cuenta,
            entidadId: cuenta.id,
            empresaRevendedoraId: cuenta.empresaRevendedoraId,
            detalle: { cuenta_id: cuenta.id, origen: 'automatico' },
          });
          cerrados += 1;
        });
      }
    }

    return { cerrados };
  }

  /**
   * Barrido de cuentas de prueba vencidas (HU-P06).
   *
   * Busca, por Operador Principal, las pruebas activas cuyo `prueba_vence_en` ya
   * pasó y las cierra en el Proveedor y localmente. El Cliente Final NO se toca:
   * queda sin Cuenta. El consumo mensual no se modifica (el cupo no se devuelve).
   *
   * Si el Proveedor falla, la Cuenta queda intacta localmente y el próximo
   * barrido vuelve a intentarlo: es la vía de reintento. Idempotente.
   */
  private async barrerPruebasVencidas(): Promise<{ cerradas: number; fallidas: number }> {
    const operadores = await this.prisma.operadorPrincipal.findMany({ select: { id: true } });
    const ahora = new Date();
    let cerradas = 0;
    let fallidas = 0;

    for (const operador of operadores) {
      const vencidas = await this.prisma.transactionComoOperador(operador.id, (tx) =>
        tx.cuenta.findMany({
          where: { esPrueba: true, estado: EstadoCuenta.activa, pruebaVenceEn: { lte: ahora } },
          select: { id: true, empresaRevendedoraId: true, proveedorCuentaId: true },
        }),
      );

      for (const cuenta of vencidas) {
        try {
          const cerro = await this.cerrarPruebaVencida(cuenta, operador.id);
          if (cerro) cerradas += 1;
        } catch (error) {
          fallidas += 1;
          await this.registrarFalloCierrePrueba(cuenta, operador.id, error);
        }
      }
    }

    if (cerradas > 0 || fallidas > 0) {
      this.logger.log(
        `Barrido de pruebas vencidas: ${cerradas} cerrada(s), ${fallidas} con fallo (se reintentan).`,
      );
    }
    return { cerradas, fallidas };
  }

  /**
   * Cierra una cuenta de prueba vencida. Devuelve `true` si la cerró, `false` si
   * otra corrida ya lo había hecho (idempotencia).
   *
   * Orden: primero el Proveedor (fuera de la transacción, como en el alta). Si
   * falla, se propaga y NO se toca el estado local — así se evita quedar con una
   * Cuenta falsamente cerrada. Recién con el Proveedor cerrado se desvincula al
   * Cliente Final y se marca la Cuenta como cerrada.
   */
  private async cerrarPruebaVencida(
    cuenta: { id: string; empresaRevendedoraId: string; proveedorCuentaId: string | null },
    operadorPrincipalId: string,
  ): Promise<boolean> {
    if (cuenta.proveedorCuentaId) {
      await this.proveedor.cerrarCuenta(operadorPrincipalId, cuenta.proveedorCuentaId);
    }

    return this.prisma.transactionComoOperador(operadorPrincipalId, async (tx) => {
      // Cancela las ventanas de vinculación abiertas de la Cuenta: los equipos ya
      // no tienen a dónde vincularse.
      await tx.solicitudVinculacionDispositivo.updateMany({
        where: {
          cuentaId: cuenta.id,
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
      // Desvincula los Dispositivos de la Cuenta (no se borran: quedan como
      // historial). El Cliente Final no se toca.
      await tx.dispositivo.updateMany({
        where: { cuentaId: cuenta.id },
        data: {
          estado: EstadoDispositivo.dado_de_baja,
          estadoVinculacion: EstadoVinculacionDispositivo.cancelado,
          proveedorDeviceId: null,
          clienteFinalId: null,
        },
      });
      await tx.ventaCompartida.deleteMany({ where: { cuentaId: cuenta.id } });

      // Actualización condicional: si otra corrida ya la cerró, no repite el
      // efecto ni la auditoría.
      const actualizadas = await tx.cuenta.updateMany({
        where: { id: cuenta.id, esPrueba: true, estado: EstadoCuenta.activa },
        data: {
          estado: EstadoCuenta.cerrada,
          esPrueba: false,
          pruebaVenceEn: null,
          clienteFinalExclusivoId: null,
        },
      });
      if (actualizadas.count !== 1) return false;

      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.cierre_automatico_cuenta_prueba,
        entidad: EntidadAuditada.Cuenta,
        entidadId: cuenta.id,
        empresaRevendedoraId: cuenta.empresaRevendedoraId,
        operadorPrincipalId,
        detalle: { cuenta_id: cuenta.id, origen: 'automatico' },
      });
      return true;
    });
  }

  /**
   * Registra el fallo del cierre automático (HU-P06/P07). No audita en cada
   * barrido: sólo si no hay un fallo reciente de la misma Cuenta, para no llenar
   * el log mientras el Proveedor está caído. El reintento lo hace el próximo
   * barrido, porque la Cuenta sigue activa y con `prueba_vence_en` vencido.
   */
  private async registrarFalloCierrePrueba(
    cuenta: { id: string; empresaRevendedoraId: string },
    operadorPrincipalId: string,
    error: unknown,
  ): Promise<void> {
    const mensaje = (error as Error).message;
    this.logger.error(`No se pudo cerrar la cuenta de prueba ${cuenta.id}: ${mensaje}`);

    try {
      await this.prisma.transactionComoOperador(operadorPrincipalId, async (tx) => {
        const reciente = await tx.auditLog.findFirst({
          where: {
            accion: AccionAuditoria.fallo_cierre_cuenta_prueba,
            entidadId: cuenta.id,
            creadoEn: { gte: new Date(Date.now() - 60 * 60_000) },
          },
          select: { id: true },
        });
        if (reciente) return;

        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.fallo_cierre_cuenta_prueba,
          entidad: EntidadAuditada.Cuenta,
          entidadId: cuenta.id,
          empresaRevendedoraId: cuenta.empresaRevendedoraId,
          operadorPrincipalId,
          detalle: { cuenta_id: cuenta.id, origen: 'automatico', error: mensaje.slice(0, 300) },
        });
      });
    } catch (cause) {
      this.logger.error(
        `No se pudo auditar el fallo de cierre de la cuenta de prueba ${cuenta.id}: ` +
          (cause as Error).message,
      );
    }
  }

  /**
   * Avisos de cuentas de prueba próximas a vencer (HU-N03).
   *
   * Por cada Empresa Revendedora toma sus hitos de anticipación en días
   * (`pruebas_avisos_dias`, parametrizados por el Operador Principal) y crea una
   * notificación cuando faltan esos días o menos. La `clave` la hace idempotente:
   * un mismo hito nunca se notifica dos veces. Una prueba convertida o cerrada
   * deja de aparecer acá (el filtro exige `esPrueba` + `activa`).
   */
  private async barrerPruebasPorVencer(): Promise<{ creadas: number }> {
    const DIA_MS = 24 * 60 * 60_000;
    const operadores = await this.prisma.operadorPrincipal.findMany({ select: { id: true } });
    const ahora = new Date();
    let creadas = 0;

    for (const operador of operadores) {
      const pruebas = await this.prisma.transactionComoOperador(operador.id, (tx) =>
        tx.cuenta.findMany({
          where: { esPrueba: true, estado: EstadoCuenta.activa, pruebaVenceEn: { not: null } },
          select: {
            id: true,
            empresaRevendedoraId: true,
            pruebaVenceEn: true,
            empresaRevendedora: { select: { pruebasHabilitadas: true, pruebasAvisosDias: true } },
          },
        }),
      );

      for (const prueba of pruebas) {
        const empresa = prueba.empresaRevendedora;
        if (!empresa.pruebasHabilitadas || !prueba.pruebaVenceEn) continue;

        const msFaltantes = prueba.pruebaVenceEn.getTime() - ahora.getTime();
        if (msFaltantes <= 0) continue;

        for (const hito of empresa.pruebasAvisosDias) {
          if (msFaltantes > hito * DIA_MS) continue;

          const resultado = await this.prisma.transactionComoOperador(operador.id, (tx) =>
            this.notificaciones.crearEnTx(tx, {
              empresaRevendedoraId: prueba.empresaRevendedoraId,
              tipo: 'prueba_por_vencer',
              titulo: 'Cuenta de prueba por vencer',
              mensaje:
                `La cuenta de prueba vence en ${hito} día(s). ` +
                'Podés convertirla a permanente desde la cuenta.',
              accionTipo: 'ver_cuenta',
              accionRefId: prueba.id,
              clave: `prueba_por_vencer:${prueba.id}:${hito}`,
            }),
          );
          if (resultado.creada) creadas += 1;
        }
      }
    }

    if (creadas > 0) {
      this.logger.log(`Avisos de cuentas de prueba por vencer: ${creadas} creado(s).`);
    }
    return { creadas };
  }

  /**
   * Avisos de ventanas de alta próximas a vencer (HU-N04).
   *
   * Mismo esquema que los avisos de prueba (HU-N03), pero sobre
   * `ventana_curiosidad`: por cada Empresa Revendedora toma sus hitos en días
   * (`notif_ventana_alta_dias`, HU-N02) y crea una notificación por cada hito ya
   * alcanzado. No altera la ventana en sí: sólo lee. Una ventana revocada o
   * vencida (`fin_real_en` seteado o `fin_previsto_en` pasado) queda fuera del
   * filtro, así que deja de generar avisos. Idempotente por hito.
   */
  private async barrerVentanasPorVencer(): Promise<{ creadas: number }> {
    const DIA_MS = 24 * 60 * 60_000;
    const operadores = await this.prisma.operadorPrincipal.findMany({ select: { id: true } });
    const ahora = new Date();
    let creadas = 0;

    for (const operador of operadores) {
      const ventanas = await this.prisma.transactionComoOperador(operador.id, (tx) =>
        tx.ventanaCuriosidad.findMany({
          where: { finRealEn: null, finPrevistoEn: { gt: ahora } },
          select: {
            id: true,
            cuentaId: true,
            empresaRevendedoraId: true,
            finPrevistoEn: true,
            empresaRevendedora: { select: { notifVentanaAlta: true, notifVentanaAltaDias: true } },
          },
        }),
      );

      for (const ventana of ventanas) {
        const empresa = ventana.empresaRevendedora;
        if (!empresa.notifVentanaAlta) continue;

        const msFaltantes = ventana.finPrevistoEn.getTime() - ahora.getTime();
        if (msFaltantes <= 0) continue;

        for (const hito of empresa.notifVentanaAltaDias) {
          if (msFaltantes > hito * DIA_MS) continue;

          const resultado = await this.prisma.transactionComoOperador(operador.id, (tx) =>
            this.notificaciones.crearEnTx(tx, {
              empresaRevendedoraId: ventana.empresaRevendedoraId,
              tipo: 'ventana_alta_por_vencer',
              titulo: 'Ventana de alta por vencer',
              mensaje:
                `La ventana de alta de una cuenta vence en ${hito} día(s). ` +
                'Podés revisarla desde la cuenta.',
              accionTipo: 'ver_cuenta',
              accionRefId: ventana.cuentaId,
              clave: `ventana_alta_por_vencer:${ventana.id}:${hito}`,
            }),
          );
          if (resultado.creada) creadas += 1;
        }
      }
    }

    if (creadas > 0) {
      this.logger.log(`Avisos de ventanas de alta por vencer: ${creadas} creado(s).`);
    }
    return { creadas };
  }

  /**
   * Recordatorios de dispositivos pendientes (HU-D04).
   *
   * Mientras un evento pendiente siga sin resolver, emite un aviso cada la
   * frecuencia configurada por la Empresa Revendedora
   * (`notif_dispositivos` + `notif_dispositivos_frecuencia_horas`, HU-N02). No
   * depende del cron de detección y no crea una notificación por barrido: usa
   * `ultimo_recordatorio_en` (o la fecha de detección la primera vez) para
   * decidir. Cuando el dispositivo se asocia —por autoasignación (D02) o por el
   * flujo manual— el evento deja de estar `pendiente` y cesan los recordatorios.
   */
  private async barrerRecordatoriosDispositivos(): Promise<{ recordatorios: number }> {
    const operadores = await this.prisma.operadorPrincipal.findMany({ select: { id: true } });
    const ahora = new Date();
    let recordatorios = 0;

    for (const operador of operadores) {
      const pendientes = await this.prisma.transactionComoOperador(operador.id, (tx) =>
        tx.incidenciaDispositivoProveedor.findMany({
          where: {
            estado: EstadoIncidenciaDispositivo.pendiente,
            empresaRevendedora: { notifDispositivos: true },
          },
          select: {
            id: true,
            cuentaId: true,
            empresaRevendedoraId: true,
            primeraDeteccionEn: true,
            ultimoRecordatorioEn: true,
            empresaRevendedora: { select: { notifDispositivosFrecuenciaHoras: true } },
          },
        }),
      );

      for (const pendiente of pendientes) {
        const frecuenciaMs =
          pendiente.empresaRevendedora.notifDispositivosFrecuenciaHoras * 60 * 60_000;
        const referencia = pendiente.ultimoRecordatorioEn ?? pendiente.primeraDeteccionEn;
        if (ahora.getTime() - referencia.getTime() < frecuenciaMs) continue;

        await this.prisma.transactionComoOperador(operador.id, async (tx) => {
          // Condicional: si otra corrida ya lo recordó (o se resolvió), no repite.
          const actualizadas = await tx.incidenciaDispositivoProveedor.updateMany({
            where: { id: pendiente.id, estado: EstadoIncidenciaDispositivo.pendiente },
            data: { ultimoRecordatorioEn: ahora },
          });
          if (actualizadas.count !== 1) return;

          await this.notificaciones.crearEnTx(tx, {
            empresaRevendedoraId: pendiente.empresaRevendedoraId,
            tipo: 'dispositivo_pendiente',
            titulo: 'Recordatorio: dispositivo pendiente',
            mensaje:
              'Sigue pendiente un dispositivo sin asignar en una cuenta. Revisá la cuenta para ' +
              'asignarlo o darlo de baja.',
            accionTipo: 'ver_cuenta',
            accionRefId: pendiente.cuentaId,
            clave: `dispositivo_pendiente:${pendiente.id}:recordatorio:${ahora.getTime()}`,
          });
          recordatorios += 1;
        });
      }
    }

    if (recordatorios > 0) {
      this.logger.log(`Recordatorios de dispositivos pendientes: ${recordatorios} enviado(s).`);
    }
    return { recordatorios };
  }

  /**
   * Núcleo compartido del barrido: compara el inventario real de SENSA contra
   * lo que IPTVControl conoce (Dispositivos vendidos). Todo lo que no está en
   * esa lista queda como incidencia PENDIENTE — nunca se elimina desde acá;
   * eso es una decisión manual de la Empresa Revendedora vía
   * `/device-incidents/:id/resolve`.
   */
  private async sincronizarInventarioCuenta(
    cuentaId: string,
    empresaRevendedoraId: string,
    proveedorCuentaId: string,
    operadorPrincipalId: string,
  ): Promise<number> {
    const inventario = await this.proveedor.listarDispositivos(
      operadorPrincipalId,
      proveedorCuentaId,
    );
    if (inventario.length === 0) return 0;

    return this.prisma.transactionComoOperador(operadorPrincipalId, async (tx) => {
      const [conocidos, ventanasAbiertas] = await Promise.all([
        tx.dispositivo.findMany({
          where: { cuentaId, proveedorDeviceId: { not: null } },
          select: { proveedorDeviceId: true },
        }),
        tx.solicitudVinculacionDispositivo.count({
          where: {
            cuentaId,
            estado: {
              in: [
                EstadoSolicitudVinculacion.pendiente,
                EstadoSolicitudVinculacion.observando,
                EstadoSolicitudVinculacion.ambiguo,
              ],
            },
          },
        }),
      ]);

      const permitidos = new Set(conocidos.map((d) => d.proveedorDeviceId));

      // Autocuración: una incidencia pendiente cuyo Dispositivo ya está
      // vinculado quedó huérfana de una carrera anterior (la consulta manual o
      // este mismo barrido la detectaron como "desconocido" segundos antes de
      // que el sondeo normal la reclamara). Se cierra sola, no depende de que
      // haya o no una ventana abierta ahora — el equipo ya tiene dueño.
      const pendientesConDueno = await tx.incidenciaDispositivoProveedor.findMany({
        where: {
          cuentaId,
          estado: EstadoIncidenciaDispositivo.pendiente,
          proveedorDeviceId: { in: [...permitidos].filter((id): id is string => id !== null) },
        },
      });
      for (const incidencia of pendientesConDueno) {
        await tx.incidenciaDispositivoProveedor.update({
          where: { id: incidencia.id },
          data: { estado: EstadoIncidenciaDispositivo.reconocido, resueltaEn: new Date() },
        });
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.resolucion_incidencia_dispositivo,
          entidad: EntidadAuditada.IncidenciaDispositivoProveedor,
          entidadId: incidencia.id,
          empresaRevendedoraId,
          operadorPrincipalId,
          detalle: {
            cuenta_id: cuentaId,
            proveedor_device_id: incidencia.proveedorDeviceId,
            resolucion: 'auto_vinculado',
            origen: 'barrido_periodico',
          },
        });
      }

      // Con una vinculación en curso, un candidato "desconocido" todavía puede
      // ser el equipo legítimo de la venta: el sondeo de esa solicitud ya lo
      // resuelve. Evita ruido duplicado durante los 10 minutos de la ventana.
      if (ventanasAbiertas > 0) return 0;

      const desconocidos = inventario.filter((item) => !permitidos.has(item.proveedorDeviceId));
      if (desconocidos.length === 0) return 0;

      // Clientes Finales ACTIVOS de la Cuenta (los dados de baja y los
      // suspendidos no cuentan). Es el dato que decide si el dispositivo se
      // autoasigna (1) o se notifica (0 / 2+) en HU-D02/D03. Se refresca en cada
      // detección para reflejar el estado actual del evento pendiente (HU-D01).
      const clientesActivos = await this.listarClientesActivos(tx, cuentaId);

      let nuevas = 0;
      for (const item of desconocidos) {
        const existente = await tx.incidenciaDispositivoProveedor.findUnique({
          where: {
            cuentaId_proveedorDeviceId: { cuentaId, proveedorDeviceId: item.proveedorDeviceId },
          },
        });

        let registrada: {
          id: string;
          proveedorDeviceId: string;
          mac: string | null;
          tipoProveedor: string | null;
        };

        if (existente?.estado === EstadoIncidenciaDispositivo.pendiente) {
          registrada = await tx.incidenciaDispositivoProveedor.update({
            where: { id: existente.id },
            data: {
              cantidadDetecciones: { increment: 1 },
              ultimaDeteccionEn: new Date(),
              clientesActivosAlDetectar: clientesActivos.length,
            },
          });
        } else {
          registrada = existente
            ? await tx.incidenciaDispositivoProveedor.update({
                where: { id: existente.id },
                data: {
                  estado: EstadoIncidenciaDispositivo.pendiente,
                  mac: item.mac,
                  tipoProveedor: item.tipo,
                  cantidadDetecciones: { increment: 1 },
                  ultimaDeteccionEn: new Date(),
                  resueltaEn: null,
                  clientesActivosAlDetectar: clientesActivos.length,
                },
              })
            : await tx.incidenciaDispositivoProveedor.create({
                data: {
                  cuentaId,
                  empresaRevendedoraId,
                  proveedorDeviceId: item.proveedorDeviceId,
                  mac: item.mac,
                  tipoProveedor: item.tipo,
                  clientesActivosAlDetectar: clientesActivos.length,
                },
              });

          nuevas += 1;
          await this.audit.registrarEnTx(tx, {
            accion: AccionAuditoria.deteccion_dispositivo_no_autorizado,
            entidad: EntidadAuditada.IncidenciaDispositivoProveedor,
            entidadId: registrada.id,
            empresaRevendedoraId,
            operadorPrincipalId,
            detalle: {
              cuenta_id: cuentaId,
              proveedor_device_id: item.proveedorDeviceId,
              clientes_activos: clientesActivos.length,
              origen: 'barrido_periodico',
            },
          });
        }

        // HU-D02: con un único Cliente Final activo, se autoasigna y el evento
        // queda resuelto (deja de generar recordatorios).
        const asignado = await this.intentarAutoasignar(tx, {
          cuentaId,
          empresaRevendedoraId,
          operadorPrincipalId,
          incidencia: registrada,
          clientesActivos,
        });

        // HU-D03: si no se pudo asignar porque la Cuenta tiene 0 o 2+ Clientes
        // Finales activos, se notifica a la Empresa Revendedora (sin flujo de
        // asignación desde acá: sólo `Ver cuenta`).
        if (!asignado) {
          await this.notificarDispositivoPendiente(tx, {
            incidenciaId: registrada.id,
            cuentaId,
            empresaRevendedoraId,
            clientesActivos,
          });
        }
      }
      return nuevas;
    });
  }

  /**
   * Clientes Finales ACTIVOS de una Cuenta (HU-D01/D02/D03): sólo `activo`; los
   * `suspendido` y `dado_de_baja` no cuentan. Se asocia por cualquiera de sus
   * vías: venta compartida, Dispositivo o titular de una Cuenta exclusiva.
   */
  private listarClientesActivos(
    tx: TransactionClient,
    cuentaId: string,
  ): Promise<{ id: string }[]> {
    return tx.clienteFinal.findMany({
      where: {
        estado: EstadoClienteFinal.activo,
        OR: [
          { ventasCompartidas: { some: { cuentaId } } },
          { dispositivos: { some: { cuentaId } } },
          { cuentasExclusivas: { some: { id: cuentaId } } },
        ],
      },
      select: { id: true },
      orderBy: { creadoEn: 'asc' },
    });
  }

  /**
   * Autoasigna un Dispositivo sin dueño cuando la Cuenta tiene EXACTAMENTE un
   * Cliente Final activo (HU-D02). Reutiliza el mismo criterio que la resolución
   * manual de incidencias: reclama un Dispositivo pendiente del Cliente o crea
   * uno `vinculado`, respetando el cupo de su categoría. Si no hay exactamente un
   * cliente activo, falta la categoría del Proveedor, no hay venta (compartida) o
   * el cupo está lleno, NO asigna: el evento queda pendiente.
   */
  private async intentarAutoasignar(
    tx: TransactionClient,
    params: {
      cuentaId: string;
      empresaRevendedoraId: string;
      operadorPrincipalId: string;
      incidencia: {
        id: string;
        proveedorDeviceId: string;
        mac: string | null;
        tipoProveedor: string | null;
      };
      clientesActivos: { id: string }[];
    },
  ): Promise<boolean> {
    if (params.clientesActivos.length !== 1) return false;

    const cuenta = await tx.cuenta.findUnique({
      where: { id: params.cuentaId },
      select: { esExclusiva: true, clienteFinalExclusivoId: true },
    });
    if (!cuenta) return false;

    const tipo = this.tipoLocal(params.incidencia.tipoProveedor ?? undefined);
    if (!tipo) return false;

    const clienteFinalId = params.clientesActivos[0].id;
    if (
      cuenta.esExclusiva &&
      cuenta.clienteFinalExclusivoId &&
      cuenta.clienteFinalExclusivoId !== clienteFinalId
    ) {
      return false;
    }

    const venta = cuenta.esExclusiva
      ? null
      : await tx.ventaCompartida.findUnique({
          where: { cuentaId_clienteFinalId: { cuentaId: params.cuentaId, clienteFinalId } },
          select: { cuposPorCategoria: true },
        });
    if (!cuenta.esExclusiva && !venta) return false;

    const ocupados = await tx.dispositivo.count({
      where: {
        cuentaId: params.cuentaId,
        ...(cuenta.esExclusiva ? {} : { clienteFinalId }),
        tipo,
        estado: { in: [EstadoDispositivo.activo, EstadoDispositivo.bloqueado_por_suspension] },
      },
    });
    const limite = cuenta.esExclusiva ? 3 : venta!.cuposPorCategoria;
    if (ocupados >= limite) return false;

    const datos = {
      proveedorDeviceId: params.incidencia.proveedorDeviceId,
      mac: params.incidencia.mac,
      tipo,
      tipoProveedor: params.incidencia.tipoProveedor,
      estado: EstadoDispositivo.activo,
      estadoVinculacion: EstadoVinculacionDispositivo.vinculado,
    };

    const pendiente = await tx.dispositivo.findFirst({
      where: {
        cuentaId: params.cuentaId,
        clienteFinalId,
        proveedorDeviceId: null,
        estado: EstadoDispositivo.activo,
        estadoVinculacion: {
          in: [EstadoVinculacionDispositivo.pendiente, EstadoVinculacionDispositivo.observando],
        },
      },
      orderBy: { creadoEn: 'asc' },
      select: { id: true },
    });

    if (pendiente) {
      await tx.dispositivo.update({ where: { id: pendiente.id }, data: datos });
      await tx.solicitudVinculacionDispositivo.updateMany({
        where: {
          dispositivoId: pendiente.id,
          estado: {
            in: [
              EstadoSolicitudVinculacion.pendiente,
              EstadoSolicitudVinculacion.observando,
              EstadoSolicitudVinculacion.ambiguo,
            ],
          },
        },
        data: {
          estado: EstadoSolicitudVinculacion.vinculado,
          proveedorDeviceIdCandidato: params.incidencia.proveedorDeviceId,
          ultimoSondeoEn: new Date(),
        },
      });
    } else {
      await tx.dispositivo.create({
        data: {
          cuentaId: params.cuentaId,
          empresaRevendedoraId: params.empresaRevendedoraId,
          clienteFinalId,
          ...datos,
        },
      });
    }

    if (cuenta.esExclusiva && !cuenta.clienteFinalExclusivoId) {
      await tx.cuenta.update({
        where: { id: params.cuentaId },
        data: { clienteFinalExclusivoId: clienteFinalId },
      });
    }

    await tx.incidenciaDispositivoProveedor.update({
      where: { id: params.incidencia.id },
      data: { estado: EstadoIncidenciaDispositivo.reconocido, resueltaEn: new Date() },
    });
    await this.audit.registrarEnTx(tx, {
      accion: AccionAuditoria.resolucion_incidencia_dispositivo,
      entidad: EntidadAuditada.IncidenciaDispositivoProveedor,
      entidadId: params.incidencia.id,
      empresaRevendedoraId: params.empresaRevendedoraId,
      operadorPrincipalId: params.operadorPrincipalId,
      detalle: {
        cuenta_id: params.cuentaId,
        proveedor_device_id: params.incidencia.proveedorDeviceId,
        resolucion: 'vinculado',
        origen: 'automatico',
        cliente_final_id: clienteFinalId,
      },
    });
    return true;
  }

  /**
   * Notifica a la Empresa Revendedora un dispositivo pendiente que no pudo
   * autoasignarse (HU-D03). Sólo aplica a los casos de D03: 0 clientes activos
   * (Caso A) o 2 o más (Caso B). Con exactamente 1 cliente el problema no es de
   * cantidad, así que no se notifica (queda para la resolución manual existente).
   * Idempotente por `clave`: una sola notificación por evento.
   */
  private async notificarDispositivoPendiente(
    tx: TransactionClient,
    params: {
      incidenciaId: string;
      cuentaId: string;
      empresaRevendedoraId: string;
      clientesActivos: { id: string }[];
    },
  ): Promise<void> {
    const cantidad = params.clientesActivos.length;
    if (cantidad === 1) return;

    const titulo =
      cantidad === 0
        ? 'Dispositivo en una cuenta sin clientes activos'
        : 'Dispositivo nuevo sin dueño definido';
    const mensaje =
      cantidad === 0
        ? 'Se detectó un dispositivo en una cuenta que no tiene Clientes Finales activos. ' +
          'Revisá la cuenta para asignarlo o darlo de baja.'
        : 'Se detectó un dispositivo nuevo en una cuenta con más de un Cliente Final activo y no ' +
          'se pudo determinar a quién pertenece. Revisá la cuenta.';

    await this.notificaciones.crearEnTx(tx, {
      empresaRevendedoraId: params.empresaRevendedoraId,
      tipo: 'dispositivo_pendiente',
      titulo,
      mensaje,
      accionTipo: 'ver_cuenta',
      accionRefId: params.cuentaId,
      clave: `dispositivo_pendiente:${params.incidenciaId}`,
    });
  }

  /**
   * Vincula, dentro de una unica corrida de sondeo, todos los candidatos que
   * todavia tengan lugar segun el modo de la Cuenta:
   *
   *  - Exclusiva: hasta 3 fijos + 3 moviles para el unico Cliente Final.
   *  - Compartida: hasta el 1+1 o 2+2 reservado para esta venta puntual.
   *
   * Lo que no entra por categoria queda como incidencia pendiente de revision
   * manual (nunca se elimina solo) - cubre tanto un Dispositivo de mas de este
   * mismo cliente como el caso "Pepito/Marcelo" de un cliente ajeno que probo
   * sus credenciales durante la ventana.
   */
  private async vincularCandidatos(
    solicitud: {
      id: string;
      dispositivoId: string | null;
      cuentaId: string;
      empresaRevendedoraId: string;
      clienteFinalId: string | null;
      dispositivo?: {
        clienteFinalId: string | null;
        notaDescriptiva: string | null;
      } | null;
      cuenta: { esExclusiva: boolean };
    },
    candidatos: {
      proveedorDeviceId: string;
      mac?: string;
      tipo?: string;
    }[],
    operadorPrincipalId: string,
    ahora: Date,
    intento: number,
  ): Promise<unknown> {
    const resultado = await this.prisma.transactionComoOperador(operadorPrincipalId, async (tx) => {
      const clienteFinalId =
        solicitud.clienteFinalId ?? solicitud.dispositivo?.clienteFinalId ?? null;
      const yaVinculados = await tx.dispositivo.findMany({
        where: {
          cuentaId: solicitud.cuentaId,
          // En una Cuenta exclusiva el tope es por Cuenta (un unico cliente);
          // en una compartida, el tope es por Cliente Final de esta venta.
          ...(solicitud.cuenta.esExclusiva ? {} : { clienteFinalId }),
          estado: { in: [EstadoDispositivo.activo, EstadoDispositivo.bloqueado_por_suspension] },
          proveedorDeviceId: { not: null },
        },
        select: { tipo: true },
      });

      const ventaCompartida = solicitud.cuenta.esExclusiva
        ? null
        : await tx.ventaCompartida.findUnique({
            where: {
              cuentaId_clienteFinalId: {
                cuentaId: solicitud.cuentaId,
                clienteFinalId: clienteFinalId!,
              },
            },
            select: { cuposPorCategoria: true },
          });
      const topePorCategoria = solicitud.cuenta.esExclusiva
        ? 3
        : (ventaCompartida?.cuposPorCategoria ?? 1);
      let ocupadosFijo = yaVinculados.filter((d) => d.tipo === TipoDispositivo.fijo).length;
      let ocupadosMovil = yaVinculados.filter((d) => d.tipo === TipoDispositivo.movil).length;

      const admitidos: typeof candidatos = [];
      const descartados: typeof candidatos = [];
      for (const candidato of candidatos) {
        const tipo = this.tipoLocal(candidato.tipo);
        if (tipo === TipoDispositivo.fijo && ocupadosFijo < topePorCategoria) {
          admitidos.push(candidato);
          ocupadosFijo += 1;
        } else if (tipo === TipoDispositivo.movil && ocupadosMovil < topePorCategoria) {
          admitidos.push(candidato);
          ocupadosMovil += 1;
        } else {
          descartados.push(candidato);
        }
      }

      const completa = ocupadosFijo >= topePorCategoria && ocupadosMovil >= topePorCategoria;

      if (admitidos.length > 0) {
        const [primero, ...adicionales] = admitidos;
        if (solicitud.dispositivoId) {
          // Venta con fila previa (exclusiva, alta adicional, legados): la fila
          // esperaba su equipo y ahora se completa con el detectado.
          await tx.dispositivo.update({
            where: { id: solicitud.dispositivoId },
            data: {
              proveedorDeviceId: primero.proveedorDeviceId,
              mac: primero.mac ?? null,
              tipo: this.tipoLocal(primero.tipo),
              tipoProveedor: primero.tipo ?? null,
              estadoVinculacion: EstadoVinculacionDispositivo.vinculado,
            },
          });
        } else {
          // Venta compartida SIN fila previa (Pieza 4): se materializa el
          // Dispositivo recién ahora, cuando SENSA lo reportó, y la Solicitud
          // pasa a referenciarlo.
          const creado = await tx.dispositivo.create({
            data: {
              cuentaId: solicitud.cuentaId,
              empresaRevendedoraId: solicitud.empresaRevendedoraId,
              clienteFinalId,
              proveedorDeviceId: primero.proveedorDeviceId,
              mac: primero.mac ?? null,
              tipo: this.tipoLocal(primero.tipo),
              tipoProveedor: primero.tipo ?? null,
              estado: EstadoDispositivo.activo,
              estadoVinculacion: EstadoVinculacionDispositivo.vinculado,
              notaDescriptiva: solicitud.dispositivo?.notaDescriptiva ?? null,
            },
          });
          await tx.solicitudVinculacionDispositivo.update({
            where: { id: solicitud.id },
            data: { dispositivoId: creado.id },
          });
        }
        for (const adicional of adicionales) {
          await tx.dispositivo.create({
            data: {
              cuentaId: solicitud.cuentaId,
              empresaRevendedoraId: solicitud.empresaRevendedoraId,
              clienteFinalId,
              proveedorDeviceId: adicional.proveedorDeviceId,
              mac: adicional.mac ?? null,
              tipo: this.tipoLocal(adicional.tipo),
              tipoProveedor: adicional.tipo ?? null,
              estado: EstadoDispositivo.activo,
              estadoVinculacion: EstadoVinculacionDispositivo.vinculado,
            },
          });
        }
        await tx.solicitudVinculacionDispositivo.update({
          where: { id: solicitud.id },
          data: {
            estado: completa
              ? EstadoSolicitudVinculacion.vinculado
              : EstadoSolicitudVinculacion.observando,
            proveedorDeviceIdCandidato: primero.proveedorDeviceId,
            ultimoSondeoEn: ahora,
            proximoSondeoEn: new Date(ahora.getTime() + 30_000),
            cantidadIntentos: { increment: 1 },
          },
        });
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.vinculacion_dispositivo,
          entidad: EntidadAuditada.SolicitudVinculacionDispositivo,
          entidadId: solicitud.id,
          empresaRevendedoraId: solicitud.empresaRevendedoraId,
          operadorPrincipalId,
          detalle: {
            cuenta_id: solicitud.cuentaId,
            proveedor_device_ids: admitidos.map((item) => item.proveedorDeviceId),
            completa,
          },
        });
      }

      for (const descartado of descartados) {
        await tx.incidenciaDispositivoProveedor.upsert({
          where: {
            cuentaId_proveedorDeviceId: {
              cuentaId: solicitud.cuentaId,
              proveedorDeviceId: descartado.proveedorDeviceId,
            },
          },
          create: {
            cuentaId: solicitud.cuentaId,
            empresaRevendedoraId: solicitud.empresaRevendedoraId,
            proveedorDeviceId: descartado.proveedorDeviceId,
            mac: descartado.mac,
            tipoProveedor: descartado.tipo,
          },
          update: { cantidadDetecciones: { increment: 1 }, ultimaDeteccionEn: ahora },
        });
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.deteccion_dispositivo_no_autorizado,
          entidad: EntidadAuditada.IncidenciaDispositivoProveedor,
          empresaRevendedoraId: solicitud.empresaRevendedoraId,
          operadorPrincipalId,
          detalle: {
            cuenta_id: solicitud.cuentaId,
            proveedor_device_id: descartado.proveedorDeviceId,
            motivo: solicitud.cuenta.esExclusiva
              ? 'Excede el limite de 3 fijos / 3 moviles de la Cuenta.'
              : `Excede el limite de ${topePorCategoria} fijo(s) / ${topePorCategoria} movil(es) de esta venta.`,
          },
        });
      }

      return { nuevos: admitidos.length, completa, descartados };
    });

    if (!resultado.completa) {
      await this.cola.encolarSondeoVinculacion({
        solicitudId: solicitud.id,
        operadorPrincipalId,
        intento: intento + 1,
      });
    }
    return {
      activa: !resultado.completa,
      vinculada: resultado.nuevos > 0,
      dispositivos: resultado.nuevos,
    };
  }

  /**
   * SENSA reporta el tipo como "phone", "tablet", "stationary", "STB" o
   * "cloud_client" (reproductor web, ej. una PC). `cloud_client` se
   * contabiliza como **móvil** junto con phone/tablet (confirmado por Bruno
   * el 24/08/2026, caso Valentín Alamo: una venta compartida necesita poder
   * tener 1 TV/stationary "fijo" + 1 PC/cloud_client "móvil" sin chocar
   * cupos). `stationary`/`STB` son fijos.
   */
  private tipoLocal(tipoProveedor?: string): TipoDispositivo | null {
    const tipo = (tipoProveedor ?? '').toLowerCase();
    if (['phone', 'tablet', 'cloud_client'].includes(tipo)) return TipoDispositivo.movil;
    if (['stationary', 'stb'].includes(tipo)) return TipoDispositivo.fijo;
    return null;
  }

  private async cerrarCuenta(datos: DatosCerrarCuenta): Promise<unknown> {
    await this.proveedor.cerrarCuenta(datos.operadorPrincipalId, datos.proveedorCuentaId);
    await this.prisma.transactionComoOperador(datos.operadorPrincipalId, async (tx) => {
      await tx.cuenta.update({
        where: { id: datos.cuentaId },
        data: { estado: EstadoCuenta.cerrada },
      });
    });
    return { cerrada: true };
  }

  /**
   * SENSA reporta el tipo como "phone", "tablet", "stationary", "STB" o
   * "cloud_client". Los tres primeros son móviles; stationary/STB, fijos.
   */
  private coincideTipo(tipoProveedor: string | undefined, tipoLocal: TipoDispositivo): boolean {
    const esMovil = ['phone', 'tablet', 'cloud_client'].includes(
      (tipoProveedor ?? '').toLowerCase(),
    );
    return tipoLocal === TipoDispositivo.movil ? esMovil : !esMovil;
  }
}
