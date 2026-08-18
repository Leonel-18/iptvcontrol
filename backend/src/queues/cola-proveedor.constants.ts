/**
 * Nombres y tipos de trabajo de la cola de operaciones contra el Proveedor.
 *
 * Por qué existe esta cola (docs/04_Esqueleto_Tecnico_Inicial.md, sección 6):
 * cuando la API del Proveedor falla DESPUÉS de que el estado local ya quedó
 * confirmado, no se puede "deshacer" lo local sin mentirle al usuario. Entonces
 * la corrección pendiente se encola y se reintenta con espera creciente, hasta
 * que la parametrización del Proveedor coincida con lo que dice IPTVControl.
 *
 * Es el mismo criterio que usa un ISP con una orden de trabajo que no pudo
 * ejecutarse: no se descarta, queda pendiente y se reintenta.
 */
export const COLA_PROVEEDOR = 'proveedor-operaciones';

export const TRABAJOS_PROVEEDOR = {
  /** Reenvía a la parametrización del Proveedor la capacidad que dice la base. */
  SINCRONIZAR_CAPACIDAD: 'sincronizar_capacidad_cuenta',
  /** Reintenta la eliminación de un dispositivo en el Proveedor. */
  ELIMINAR_DISPOSITIVO: 'eliminar_dispositivo',
  /** Captura por polling los `device_id` de dispositivos auto-provisionados. */
  RECONCILIAR_DISPOSITIVOS: 'reconciliar_dispositivos_cuenta',
  /** Reintenta el cierre de una Cuenta en el Proveedor. */
  CERRAR_CUENTA: 'cerrar_cuenta',
} as const;

export interface DatosSincronizarCapacidad {
  cuentaId: string;
  operadorPrincipalId: string;
}

export interface DatosEliminarDispositivo {
  proveedorDeviceId: string;
  operadorPrincipalId: string;
  dispositivoId?: string;
}

export interface DatosReconciliarDispositivos {
  cuentaId: string;
  operadorPrincipalId: string;
}

export interface DatosCerrarCuenta {
  cuentaId: string;
  proveedorCuentaId: string;
  operadorPrincipalId: string;
}

/**
 * Política de reintentos: 6 intentos con espera exponencial desde 30 segundos
 * (30s, 1m, 2m, 4m, 8m, 16m). Cubre una caída corta del Proveedor sin machacarlo
 * ni dejar la corrección colgada más de una hora.
 */
export const OPCIONES_REINTENTO = {
  attempts: 6,
  backoff: { type: 'exponential' as const, delay: 30_000 },
  removeOnComplete: { age: 86_400, count: 500 },
  removeOnFail: { age: 604_800 },
};
