import { EstadoDispositivo, TipoDispositivo } from '@prisma/client';
import { TOPE_DISPOSITIVOS_POR_CATEGORIA } from '../../proveedor/sensa/sensa.constants';

/**
 * =============================================================================
 * Capacidad de una Cuenta — funciones puras, sin base de datos
 * =============================================================================
 * Modelo mental (docs/03_Reglas_de_Negocio.md, secciones 2 y 3):
 *
 *   habilitados(tipo)  → cuántos dispositivos de esa categoría tiene habilitados
 *                        la Cuenta en el Proveedor (arranca en 1, tope 3).
 *   ocupados(tipo)     → cuántos Dispositivos de IPTVControl los están usando.
 *                        Cuentan los `activo` y también los
 *                        `bloqueado_por_suspension`: estos últimos están
 *                        liberados en SENSA pero RESERVADOS, no se le pueden dar
 *                        a otro Cliente Final mientras el titular siga
 *                        suspendido.
 *
 * De ahí salen las dos formas de conseguir lugar para un alta:
 *   1. `libres > 0`      → hay un cupo ya habilitado y sin usar: se activa el
 *                          Dispositivo sin tocar la parametrización en SENSA.
 *   2. `puedeAmpliar`    → no hay cupo libre pero la Cuenta no llegó al tope:
 *                          se suma +1 dispositivo vía API (de a uno por vez,
 *                          nunca en bloque) y se activa.
 * Si ninguna aplica, esta Cuenta no sirve y hay que buscar otra o crear una nueva.
 * =============================================================================
 */

export const TOPE_POR_CATEGORIA = TOPE_DISPOSITIVOS_POR_CATEGORIA;

/** Estados que ocupan lugar dentro de una Cuenta. */
export const ESTADOS_QUE_OCUPAN: EstadoDispositivo[] = [
  EstadoDispositivo.activo,
  EstadoDispositivo.bloqueado_por_suspension,
];

export interface CuentaCapacidadInput {
  dispositivosFijosHabilitados: number;
  dispositivosMovilesHabilitados: number;
  dispositivos: { tipo: TipoDispositivo; estado: EstadoDispositivo }[];
}

export interface CapacidadCategoria {
  habilitados: number;
  ocupados: number;
  libres: number;
  puedeAmpliar: boolean;
  /** true cuando conviene avisar que la Cuenta está cerca del tope. */
  cercaDelTope: boolean;
}

export interface CapacidadCuenta {
  fijo: CapacidadCategoria;
  movil: CapacidadCategoria;
  /** No hay lugar en ninguna de las dos categorías, ni ampliando. */
  completa: boolean;
}

/** Cantidad de Dispositivos que ocupan lugar en una categoría. */
export const contarOcupados = (
  dispositivos: { tipo: TipoDispositivo; estado: EstadoDispositivo }[],
  tipo: TipoDispositivo,
): number =>
  dispositivos.filter(
    (dispositivo) => dispositivo.tipo === tipo && ESTADOS_QUE_OCUPAN.includes(dispositivo.estado),
  ).length;

/**
 * Calcula la capacidad de una Cuenta.
 *
 * @param umbralAlerta cantidad de dispositivos habilitados a partir de la cual
 *        se avisa que la Cuenta está cerca del tope (reglas de negocio, sección
 *        12: valor inicial 2 de 3, parametrizable por el Operador Principal).
 */
export const calcularCapacidad = (
  cuenta: CuentaCapacidadInput,
  umbralAlerta = 2,
): CapacidadCuenta => {
  const armar = (habilitados: number, ocupados: number): CapacidadCategoria => {
    const habilitadosAcotados = Math.min(Math.max(habilitados, 0), TOPE_POR_CATEGORIA);
    return {
      habilitados: habilitadosAcotados,
      ocupados,
      libres: Math.max(0, habilitadosAcotados - ocupados),
      puedeAmpliar: habilitadosAcotados < TOPE_POR_CATEGORIA && ocupados < TOPE_POR_CATEGORIA,
      cercaDelTope: Math.max(habilitadosAcotados, ocupados) >= umbralAlerta,
    };
  };

  const fijo = armar(
    cuenta.dispositivosFijosHabilitados,
    contarOcupados(cuenta.dispositivos, TipoDispositivo.fijo),
  );
  const movil = armar(
    cuenta.dispositivosMovilesHabilitados,
    contarOcupados(cuenta.dispositivos, TipoDispositivo.movil),
  );

  return {
    fijo,
    movil,
    completa: !tieneLugarPara(fijo) && !tieneLugarPara(movil),
  };
};

/** ¿Esta categoría admite un Dispositivo más, ya sea con cupo libre o ampliando? */
export const tieneLugarPara = (categoria: CapacidadCategoria): boolean =>
  categoria.libres > 0 || categoria.puedeAmpliar;

/** Atajo por tipo de Dispositivo. */
export const capacidadDe = (
  capacidad: CapacidadCuenta,
  tipo: TipoDispositivo,
): CapacidadCategoria => (tipo === TipoDispositivo.fijo ? capacidad.fijo : capacidad.movil);

/**
 * Cantidad de dispositivos que habría que dejar habilitados en el Proveedor para
 * alojar un Dispositivo más de la categoría pedida.
 *
 * Devuelve null si la Cuenta ya está en el tope de esa categoría: en ese caso
 * hay que buscar otra Cuenta o crear una nueva (flujo 4.1 / 4.4 de docs/04).
 */
export const habilitadosNecesariosParaAlta = (
  capacidad: CapacidadCuenta,
  tipo: TipoDispositivo,
): number | null => {
  const categoria = capacidadDe(capacidad, tipo);
  if (categoria.libres > 0) return categoria.habilitados; // ya hay cupo, no se toca
  if (!categoria.puedeAmpliar) return null;
  return categoria.habilitados + 1;
};

/**
 * Cantidad de dispositivos habilitados que corresponde dejar tras una baja.
 *
 * La baja es la lógica exactamente inversa al alta: se resta 1 dispositivo
 * habilitado (reglas de negocio, sección 3). El mínimo es 1 para los móviles,
 * porque SENSA exige `auto_provision_count_mobile` entre 1 y 3; para los fijos
 * el mínimo es 0.
 */
export const habilitadosTrasBaja = (habilitadosActuales: number, tipo: TipoDispositivo): number => {
  const minimo = tipo === TipoDispositivo.movil ? 1 : 0;
  return Math.max(minimo, habilitadosActuales - 1);
};
