import { DispositivoProveedor } from './proveedor-adapter.interface';

/**
 * Convierte la fecha de SENSA (`DD/MM/YYYY HH:mm`, hora argentina) a UTC.
 * También acepta ISO para mantener el contrato desacoplado del proveedor actual.
 */
export function parsearUltimoInicioProveedor(valor?: string | null): Date | undefined {
  const texto = valor?.trim();
  if (!texto) return undefined;

  const sensa = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/.exec(texto);
  if (sensa) {
    const [, dia, mes, anio, hora, minuto] = sensa;
    const fecha = new Date(
      Date.UTC(Number(anio), Number(mes) - 1, Number(dia), Number(hora) + 3, Number(minuto)),
    );
    return Number.isNaN(fecha.getTime()) ? undefined : fecha;
  }

  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}

/** Campos que pueden actualizarse sin borrar valores válidos si SENSA los omite. */
export function metadatosDispositivoProveedor(item: DispositivoProveedor) {
  const modelo = item.modelo?.trim();
  const ultimoInicio = parsearUltimoInicioProveedor(item.ultimoInicio);
  return {
    ...(modelo ? { modelo } : {}),
    ...(ultimoInicio ? { ultimoInicio } : {}),
  };
}
