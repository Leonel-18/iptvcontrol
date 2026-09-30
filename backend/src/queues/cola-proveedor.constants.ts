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
  /** Reintenta la eliminación de un dispositivo en el Proveedor. */
  ELIMINAR_DISPOSITIVO: 'eliminar_dispositivo',
  /** Captura por polling los `device_id` de dispositivos auto-provisionados. */
  RECONCILIAR_DISPOSITIVOS: 'reconciliar_dispositivos_cuenta',
  /** Sondea una solicitud durable durante su ventana de vinculación. */
  SONDEAR_VINCULACION: 'sondear_vinculacion_dispositivo',
  /** Recupera solicitudes durables que no tienen un sondeo en cola. */
  BARRER_VINCULACIONES: 'barrer_vinculaciones_pendientes',
  /**
   * Reintenta sincronizar con SENSA los contadores `dispositivos_fijos` /
   * `dispositivos_moviles` de una Cuenta compartida, a partir de sus ventas
   * activas reales (docs/03_Reglas_de_Negocio.md, sección 2.2).
   */
  SINCRONIZAR_CONTADORES_VENTA: 'sincronizar_contadores_venta',
  /**
   * Barrido periódico de todas las Cuentas: detecta Dispositivos que se
   * auto-provisionaron por fuera de una venta (ej. reproductor web con
   * credenciales compartidas) sin esperar a que la Empresa Revendedora abra el
   * botón de sincronización manual. Nunca elimina: sólo deja incidencia.
   */
  BARRER_INVENTARIO_CUENTAS: 'barrer_inventario_cuentas',
  /** Reintenta el cierre de una Cuenta en el Proveedor. */
  CERRAR_CUENTA: 'cerrar_cuenta',
  /**
   * Cierra los aislamientos de Cuenta vencidos (HU-A03): devuelve la Cuenta a
   * `Compartida` sin tocar ventanas ni capacidad. Idempotente.
   */
  BARRER_AISLAMIENTOS: 'barrer_aislamientos_cuenta',
  /**
   * Cierra las cuentas de prueba vencidas (HU-P06): las cierra en el Proveedor
   * y desvincula al Cliente Final (sin darlo de baja). Idempotente; si el
   * Proveedor falla, no marca nada localmente y reintenta en el próximo barrido.
   */
  BARRER_PRUEBAS_VENCIDAS: 'barrer_pruebas_vencidas',
  /**
   * Genera los avisos de cuentas de prueba próximas a vencer (HU-N03) según los
   * hitos en días configurados para cada Empresa Revendedora. Idempotente: un
   * mismo hito no se notifica dos veces.
   */
  BARRER_PRUEBAS_POR_VENCER: 'barrer_pruebas_por_vencer',
  /**
   * Genera los avisos de ventanas de alta próximas a vencer (HU-N04) según los
   * hitos en días configurados para cada Empresa Revendedora. Idempotente.
   */
  BARRER_VENTANAS_POR_VENCER: 'barrer_ventanas_por_vencer',
} as const;

export interface DatosEliminarDispositivo {
  proveedorDeviceId: string;
  operadorPrincipalId: string;
  dispositivoId?: string;
}

export interface DatosReconciliarDispositivos {
  cuentaId: string;
  operadorPrincipalId: string;
}

export interface DatosSondearVinculacion {
  solicitudId: string;
  operadorPrincipalId: string;
  intento: number;
}

export interface DatosSincronizarContadoresVenta {
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
