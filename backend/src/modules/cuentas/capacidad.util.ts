import { EstadoDispositivo, TipoDispositivo } from '@prisma/client';

/**
 * =============================================================================
 * Capacidad de una Cuenta — modelo por categoría
 * =============================================================================
 * Reemplaza el modelo anterior de "3 Dispositivos globales + reservas técnicas
 * fantasma". El bloqueo real de capacidad ahora lo hace SENSA mismo, a través
 * de sus contadores nativos `auto_provision_count_mobile` /
 * `auto_provision_count_stationary`: IPTVControl sólo tiene que mantenerlos
 * sincronizados con los cupos comprometidos por sus ventas activas.
 *
 *  - Cuenta COMPARTIDA (es_exclusiva = false): tiene 3 cupos por categoría.
 *    Cada venta reserva 1+1 o 2+2; por ejemplo, admite tres ventas 1+1 o una
 *    venta 2+2 más otra 1+1.
 *  - Cuenta EXCLUSIVA (es_exclusiva = true): un único Cliente Final, con hasta
 *    3 fijos + 3 móviles (6 Dispositivos en total), sin relación con ventas.
 * =============================================================================
 */

/** Estados que consumen un cupo (venta o categoría) dentro de una Cuenta. */
export const ESTADOS_QUE_OCUPAN: EstadoDispositivo[] = [
  EstadoDispositivo.activo,
  EstadoDispositivo.bloqueado_por_suspension,
];

/** Tope por categoría en una Cuenta exclusiva: hasta 3 fijos y hasta 3 móviles. */
export const LIMITE_POR_CATEGORIA_EXCLUSIVA = 3;
/** Tope comercial por categoría en una Cuenta compartida. */
export const LIMITE_POR_CATEGORIA_COMPARTIDA = 3;

export interface DispositivoCapacidadInput {
  tipo: TipoDispositivo | null;
  estado: EstadoDispositivo;
  clienteFinalId?: string | null;
}

export interface CuentaCapacidadInput {
  esExclusiva: boolean;
  dispositivos: DispositivoCapacidadInput[];
  ventasCompartidas?: { cuposPorCategoria: number }[];
}

export interface CapacidadCategoria {
  ocupados: number;
  limite: number;
  libres: number;
  completa: boolean;
}

export interface CapacidadCuenta {
  esExclusiva: boolean;
  /** Ventas compartidas activas. Sólo tiene sentido en Cuentas compartidas. */
  ventas: number;
  limiteVentas: number;
  fijo: CapacidadCategoria;
  movil: CapacidadCategoria;
  /** Total de Dispositivos ocupando lugar, sin importar categoría. */
  ocupados: number;
  limite: number;
  libres: number;
  completa: boolean;
  cercaDelTope: boolean;
}

export const contarOcupados = (
  dispositivos: { tipo: TipoDispositivo | null; estado: EstadoDispositivo }[],
  tipo?: TipoDispositivo,
): number =>
  dispositivos.filter(
    (dispositivo) =>
      ESTADOS_QUE_OCUPAN.includes(dispositivo.estado) &&
      (tipo === undefined || dispositivo.tipo === tipo),
  ).length;

/** Cantidad de Clientes Finales distintos con algún Dispositivo ocupando lugar en la Cuenta. */
export const contarVentasActivas = (dispositivos: DispositivoCapacidadInput[]): number =>
  new Set(
    dispositivos
      .filter(
        (dispositivo): dispositivo is DispositivoCapacidadInput & { clienteFinalId: string } =>
          ESTADOS_QUE_OCUPAN.includes(dispositivo.estado) && Boolean(dispositivo.clienteFinalId),
      )
      .map((dispositivo) => dispositivo.clienteFinalId),
  ).size;

/** Cantidad de Dispositivos que un Cliente Final puntual ocupa en una Cuenta. */
export const contarDispositivosCliente = (
  dispositivos: DispositivoCapacidadInput[],
  clienteFinalId: string,
  tipo?: TipoDispositivo,
): number =>
  dispositivos.filter(
    (dispositivo) =>
      ESTADOS_QUE_OCUPAN.includes(dispositivo.estado) &&
      dispositivo.clienteFinalId === clienteFinalId &&
      (tipo === undefined || dispositivo.tipo === tipo),
  ).length;

const armarCategoria = (ocupados: number, limite: number): CapacidadCategoria => ({
  ocupados,
  limite,
  libres: Math.max(0, limite - ocupados),
  completa: ocupados >= limite,
});

/**
 * Calcula la capacidad de una Cuenta según su modo (compartida o exclusiva).
 *
 * Para Cuentas compartidas, `fijo`/`movil` reflejan Dispositivos vinculados
 * contra cupos comprometidos. A nivel de Cuenta, `ocupados` representa esos
 * cupos comerciales (no la cantidad de Clientes Finales ni de equipos reales).
 */
export const calcularCapacidad = (
  cuenta: CuentaCapacidadInput,
  umbralAlerta = 2,
): CapacidadCuenta => {
  const ocupadosFijo = contarOcupados(cuenta.dispositivos, TipoDispositivo.fijo);
  const ocupadosMovil = contarOcupados(cuenta.dispositivos, TipoDispositivo.movil);
  const ocupados = contarOcupados(cuenta.dispositivos);

  if (cuenta.esExclusiva) {
    const fijo = armarCategoria(ocupadosFijo, LIMITE_POR_CATEGORIA_EXCLUSIVA);
    const movil = armarCategoria(ocupadosMovil, LIMITE_POR_CATEGORIA_EXCLUSIVA);
    const limite = LIMITE_POR_CATEGORIA_EXCLUSIVA * 2;
    return {
      esExclusiva: true,
      ventas: 1,
      limiteVentas: 1,
      fijo,
      movil,
      ocupados,
      limite,
      libres: fijo.libres + movil.libres,
      completa: fijo.completa && movil.completa,
      cercaDelTope: ocupados >= Math.min(umbralAlerta * 2, limite),
    };
  }

  const ventas = cuenta.ventasCompartidas?.length ?? contarVentasActivas(cuenta.dispositivos);
  const cuposComprometidos = cuenta.ventasCompartidas
    ? cuenta.ventasCompartidas.reduce((total, venta) => total + venta.cuposPorCategoria, 0)
    : ventas;
  const limite = LIMITE_POR_CATEGORIA_COMPARTIDA;
  const libres = Math.max(0, limite - cuposComprometidos);
  const completa = libres === 0;

  return {
    esExclusiva: false,
    ventas,
    limiteVentas: limite,
    fijo: armarCategoria(ocupadosFijo, cuposComprometidos),
    movil: armarCategoria(ocupadosMovil, cuposComprometidos),
    ocupados: cuposComprometidos,
    limite,
    libres,
    completa,
    cercaDelTope: cuposComprometidos >= Math.min(umbralAlerta, limite),
  };
};

export const tieneLugarPara = (capacidad: CapacidadCuenta, tipo: TipoDispositivo): boolean =>
  (tipo === TipoDispositivo.fijo ? capacidad.fijo : capacidad.movil).libres > 0;
