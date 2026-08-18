import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  COLA_PROVEEDOR,
  DatosCerrarCuenta,
  DatosEliminarDispositivo,
  DatosReconciliarDispositivos,
  DatosSincronizarCapacidad,
  OPCIONES_REINTENTO,
  TRABAJOS_PROVEEDOR,
} from './cola-proveedor.constants';

/**
 * Encolado de operaciones pendientes contra el Proveedor.
 *
 * Los métodos nunca lanzan: si Redis estuviera caído, se loguea y se sigue. Un
 * problema de la cola no debe hacer fracasar una operación de negocio que ya se
 * completó correctamente.
 */
@Injectable()
export class ColaProveedorService {
  private readonly logger = new Logger(ColaProveedorService.name);

  constructor(@InjectQueue(COLA_PROVEEDOR) private readonly cola: Queue) {}

  async encolarSincronizacionCapacidad(datos: DatosSincronizarCapacidad): Promise<void> {
    await this.encolar(TRABAJOS_PROVEEDOR.SINCRONIZAR_CAPACIDAD, datos, {
      // Un solo pendiente por Cuenta: si ya hay uno esperando, no tiene sentido
      // apilar diez que van a hacer exactamente lo mismo.
      jobId: `capacidad:${datos.cuentaId}`,
    });
  }

  async encolarEliminacionDispositivo(datos: DatosEliminarDispositivo): Promise<void> {
    await this.encolar(TRABAJOS_PROVEEDOR.ELIMINAR_DISPOSITIVO, datos, {
      jobId: `eliminar-dispositivo:${datos.proveedorDeviceId}`,
    });
  }

  async encolarReconciliacion(datos: DatosReconciliarDispositivos): Promise<void> {
    await this.encolar(TRABAJOS_PROVEEDOR.RECONCILIAR_DISPOSITIVOS, datos, {
      jobId: `reconciliar:${datos.cuentaId}`,
      // Se le da tiempo al Cliente Final a encender el equipo antes de preguntar
      // al Proveedor qué dispositivo se auto-provisionó.
      delay: 5 * 60_000,
    });
  }

  async encolarCierreCuenta(datos: DatosCerrarCuenta): Promise<void> {
    await this.encolar(TRABAJOS_PROVEEDOR.CERRAR_CUENTA, datos, {
      jobId: `cerrar-cuenta:${datos.cuentaId}`,
    });
  }

  /** Estado de la cola para el panel de salud del Operador Principal. */
  async estado(): Promise<{
    pendientes: number;
    activos: number;
    fallidos: number;
    demorados: number;
    disponible: boolean;
  }> {
    try {
      const [pendientes, activos, fallidos, demorados] = await Promise.all([
        this.cola.getWaitingCount(),
        this.cola.getActiveCount(),
        this.cola.getFailedCount(),
        this.cola.getDelayedCount(),
      ]);
      return { pendientes, activos, fallidos, demorados, disponible: true };
    } catch (error) {
      this.logger.error(`No se pudo consultar el estado de la cola: ${(error as Error).message}`);
      return { pendientes: 0, activos: 0, fallidos: 0, demorados: 0, disponible: false };
    }
  }

  /** Reintenta manualmente los trabajos que quedaron fallidos. */
  async reintentarFallidos(limite = 50): Promise<number> {
    const fallidos = await this.cola.getFailed(0, limite - 1);
    let reintentados = 0;
    for (const trabajo of fallidos) {
      await trabajo.retry();
      reintentados += 1;
    }
    return reintentados;
  }

  private async encolar(
    nombre: string,
    datos: object,
    opciones: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.cola.add(nombre, datos, { ...OPCIONES_REINTENTO, ...opciones });
      this.logger.log(`Trabajo ${nombre} encolado: ${JSON.stringify(datos)}`);
    } catch (error) {
      this.logger.error(
        `No se pudo encolar ${nombre} (${JSON.stringify(datos)}): ${(error as Error).message}. ` +
          'La corrección queda pendiente de resolución manual.',
      );
    }
  }
}
