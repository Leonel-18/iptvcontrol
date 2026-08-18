import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EstadoCuenta, EstadoDispositivo, TipoDispositivo } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProveedorService } from '../proveedor/proveedor.service';
import { calcularCapacidad } from '../modules/cuentas/capacidad.util';
import {
  COLA_PROVEEDOR,
  DatosCerrarCuenta,
  DatosEliminarDispositivo,
  DatosReconciliarDispositivos,
  DatosSincronizarCapacidad,
  TRABAJOS_PROVEEDOR,
} from './cola-proveedor.constants';

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
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case TRABAJOS_PROVEEDOR.SINCRONIZAR_CAPACIDAD:
        return this.sincronizarCapacidad(job.data as DatosSincronizarCapacidad);
      case TRABAJOS_PROVEEDOR.ELIMINAR_DISPOSITIVO:
        return this.eliminarDispositivo(job.data as DatosEliminarDispositivo);
      case TRABAJOS_PROVEEDOR.RECONCILIAR_DISPOSITIVOS:
        return this.reconciliarDispositivos(job.data as DatosReconciliarDispositivos);
      case TRABAJOS_PROVEEDOR.CERRAR_CUENTA:
        return this.cerrarCuenta(job.data as DatosCerrarCuenta);
      default:
        this.logger.warn(`Trabajo desconocido en la cola: ${job.name}`);
        return null;
    }
  }

  /**
   * Deja la parametrización del Proveedor igual a la que IPTVControl considera
   * correcta: tantos dispositivos habilitados como Dispositivos ocupando lugar
   * (mínimo 1 móvil, que es lo que exige SENSA).
   */
  private async sincronizarCapacidad(datos: DatosSincronizarCapacidad): Promise<unknown> {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id: datos.cuentaId },
      include: { dispositivos: { select: { tipo: true, estado: true } } },
    });

    if (!cuenta || !cuenta.proveedorCuentaId) {
      this.logger.warn(
        `Cuenta ${datos.cuentaId} sin ID de proveedor: no hay nada que sincronizar.`,
      );
      return { sincronizada: false };
    }

    const capacidad = calcularCapacidad(cuenta);
    const fijos = Math.max(0, Math.min(3, capacidad.fijo.ocupados));
    const moviles = Math.max(1, Math.min(3, capacidad.movil.ocupados));

    await this.proveedor.actualizarCapacidadDispositivos(datos.operadorPrincipalId, {
      proveedorCuentaId: cuenta.proveedorCuentaId,
      dispositivosFijos: fijos,
      dispositivosMoviles: moviles,
    });

    await this.prisma.transactionComoOperador(datos.operadorPrincipalId, async (tx) => {
      await tx.cuenta.update({
        where: { id: cuenta.id },
        data: {
          dispositivosFijosHabilitados: fijos,
          dispositivosMovilesHabilitados: moviles,
        },
      });
    });

    this.logger.log(
      `Capacidad de la Cuenta ${cuenta.id} sincronizada con el Proveedor: ${fijos} fijos / ${moviles} móviles.`,
    );
    return { sincronizada: true, fijos, moviles };
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
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id: datos.cuentaId },
      include: {
        dispositivos: {
          where: { estado: EstadoDispositivo.activo, proveedorDeviceId: null },
        },
      },
    });

    if (!cuenta?.proveedorCuentaId || cuenta.dispositivos.length === 0) {
      return { reconciliados: 0 };
    }

    const enProveedor = await this.proveedor.listarDispositivos(
      datos.operadorPrincipalId,
      cuenta.proveedorCuentaId,
    );

    const yaConocidos = await this.prisma.dispositivo.findMany({
      where: { cuentaId: cuenta.id, proveedorDeviceId: { not: null } },
      select: { proveedorDeviceId: true },
    });
    const conocidos = new Set(yaConocidos.map((d) => d.proveedorDeviceId));
    const sinAsignar = enProveedor.filter((d) => !conocidos.has(d.proveedorDeviceId));

    let reconciliados = 0;
    for (const pendiente of cuenta.dispositivos) {
      // Se busca primero por MAC (match exacto) y si no hay, por tipo.
      const indice = pendiente.mac
        ? sinAsignar.findIndex((d) => d.mac?.toUpperCase() === pendiente.mac?.toUpperCase())
        : sinAsignar.findIndex((d) => this.coincideTipo(d.tipo, pendiente.tipo));

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
   * "cloud_client". Los dos primeros son móviles; el resto, fijos.
   */
  private coincideTipo(tipoProveedor: string | undefined, tipoLocal: TipoDispositivo): boolean {
    const esMovil = ['phone', 'tablet'].includes((tipoProveedor ?? '').toLowerCase());
    return tipoLocal === TipoDispositivo.movil ? esMovil : !esMovil;
  }
}
