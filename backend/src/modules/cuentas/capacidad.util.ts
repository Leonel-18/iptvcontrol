import { EstadoDispositivo, TipoDispositivo } from '@prisma/client';

/**
 * =============================================================================
 * Capacidad de una Cuenta — modelo por categoría
 * =============================================================================
 * Reemplaza el modelo anterior de "3 Dispositivos globales + reservas técnicas
 * fantasma". El bloqueo real de capacidad ahora lo hace SENSA mismo, a través
 * de sus contadores nativos `auto_provision_count_mobile` /
 * `auto_provision_count_stationary`: IPTVControl sólo tiene que mantenerlos
 * sincronizados con la cantidad de ventas activas de la Cuenta.
 *
 *  - Cuenta COMPARTIDA (es_exclusiva = false): aloja hasta 3 ventas unitarias
 *    (Clientes Finales distintos). Cada venta tiene derecho a hasta 1
 *    Dispositivo fijo + 1 móvil ("fijo" = TV/stationary; "móvil" = celular,
 *    tablet o PC por navegador `cloud_client`).
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
/** Tope de ventas (Clientes Finales distintos) en una Cuenta compartida. */
export const LIMITE_VENTAS_COMPARTIDA = 3;

export interface DispositivoCapacidadInput {
  tipo: TipoDispositivo | null;
  estado: EstadoDispositivo;
  clienteFinalId?: string | null;
}

export interface CuentaCapacidadInput {
  esExclusiva: boolean;
  dispositivos: DispositivoCapacidadInput[];
}

export interface CapacidadCategoria {
  ocupados: number;
  limite: number;
  libres: number;
  completa: boolean;
}

export interface CapacidadCuenta {
  esExclusiva: boolean;
  /** Ventas activas (Clientes Finales distintos con lugar ocupado). Sólo tiene sentido en compartidas. */
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
 * Para Cuentas compartidas, `fijo`/`movil` reflejan cuántos Dispositivos de esa
 * categoría hay ocupados vs. habilitados según las ventas activas (1 por venta);
 * `libres`/`completa` a nivel de Cuenta indican si hay lugar para una VENTA
 * nueva (Cliente Final nuevo), no para una categoría suelta.
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

  const ventas = contarVentasActivas(cuenta.dispositivos);
  const limiteVentas = LIMITE_VENTAS_COMPARTIDA;
  const libresVentas = Math.max(0, limiteVentas - ventas);
  const completa = libresVentas === 0;

  return {
    esExclusiva: false,
    ventas,
    limiteVentas,
    // Habilitado por categoría = cantidad de ventas activas (1 por venta): es
    // justo el valor que se le pide a SENSA en dispositivos_fijos/moviles.
    fijo: armarCategoria(ocupadosFijo, ventas),
    movil: armarCategoria(ocupadosMovil, ventas),
    // A nivel de Cuenta, "ocupados/limite" son ventas (no Dispositivos crudos):
    // es lo que hay que comparar contra el tope comercial de 3.
    ocupados: ventas,
    limite: limiteVentas,
    libres: libresVentas,
    completa,
    cercaDelTope: ventas >= Math.min(umbralAlerta, limiteVentas),
  };
};

export const tieneLugarPara = (capacidad: CapacidadCuenta, tipo: TipoDispositivo): boolean =>
  (tipo === TipoDispositivo.fijo ? capacidad.fijo : capacidad.movil).libres > 0;
