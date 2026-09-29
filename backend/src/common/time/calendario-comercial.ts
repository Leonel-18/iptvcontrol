/**
 * Utilidades de calendario comercial.
 *
 * El negocio opera en Argentina (America/Argentina/Buenos_Aires): los límites
 * mensuales ("Cuentas máximas a crear mensualmente", compromisos X5/X10) se
 * evalúan por mes calendario AR y no por ciclos de 30 días. Prisma/Postgres
 * guardan timestamps en UTC, así que este módulo traduce los bordes del mes AR
 * a instantes UTC comparables.
 */
export const ZONA_ARGENTINA = 'America/Argentina/Buenos_Aires';

/**
 * Devuelve el instante UTC del inicio del mes calendario AR que contiene a
 * `referencia` (ej. 2026-09-01 00:00 ARG => 2026-09-01 03:00 UTC, o 04:00 con
 * horario de verano si Argentina lo aplicara).
 */
export function inicioMesArgentina(referencia: Date): Date {
  return bordeMesArgentina(referencia, 0);
}

/**
 * Devuelve el instante UTC inmediatamente posterior al fin del mes calendario
 * AR que contiene a `referencia`. Para filtrar con `{ gte: inicio, lt: fin }`.
 */
export function finMesArgentina(referencia: Date): Date {
  return bordeMesArgentina(referencia, 1);
}

/**
 * Período mensual AR de `referencia` como `"YYYY-MM"` (ej. "2026-09"). Se usa
 * para acotar valores que aplican únicamente al mes en curso (extras de cuentas
 * de prueba, HU-P02).
 */
export function periodoMesArgentina(referencia: Date): string {
  const { anio, mes } = partesMesArgentina(referencia);
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

function partesMesArgentina(referencia: Date): { anio: number; mes: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_ARGENTINA,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(referencia);
  return {
    anio: Number(partes.find((parte) => parte.type === 'year')?.value),
    mes: Number(partes.find((parte) => parte.type === 'month')?.value),
  };
}

function bordeMesArgentina(referencia: Date, mesOffset: number): Date {
  const { anio, mes } = partesMesArgentina(referencia);

  const bordeLocal = new Date(Date.UTC(anio, mes - 1 + mesOffset, 1, 0, 0, 0, 0));
  // El "primer instante del mes N" expresado en la zona AR, convertido a UTC.
  const enZona = new Date(bordeLocal.toLocaleString('en-US', { timeZone: ZONA_ARGENTINA }));
  // Si el formateo anterior no interpreta bien la fecha, se corrige con la
  // diferencia de zona calculada manualmente (fallback determinístico).
  if (Number.isNaN(enZona.getTime())) {
    const diffMin = diferenciaZonaArgentina(bordeLocal);
    return new Date(bordeLocal.getTime() - diffMin * 60_000);
  }
  return enZona;
}

/**
 * Diferencia (en minutos) entre la zona horaria de Argentina y UTC para una
 * fecha dada. Argentina usa UTC-3 durante todo el año (sin horario de verano
 * desde 2009); se conserva la consulta dinámica por si eso cambiara.
 */
function diferenciaZonaArgentina(fecha: Date): number {
  const utc = new Date(fecha.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  const local = new Date(fecha.toLocaleString('en-US', { timeZone: ZONA_ARGENTINA })).getTime();
  return Math.round((utc - local) / 60_000);
}
