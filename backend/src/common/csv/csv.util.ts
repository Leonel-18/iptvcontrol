import { Response } from 'express';

export interface ColumnaCsv<T> {
  /** Encabezado que ve el usuario, en español. */
  encabezado: string;
  /** Cómo se obtiene el valor de cada fila. */
  valor: (fila: T) => string | number | null | undefined;
}

/**
 * Exportación a CSV (docs/03_Reglas_de_Negocio.md, sección 13).
 *
 * Detalles que parecen menores y no lo son:
 *  - Separador `;` y BOM UTF-8: es lo que hace que Excel en español abra el
 *    archivo bien, con acentos y columnas separadas, sin pasar por el asistente
 *    de importación. La conciliación con el CRM de la Empresa Revendedora se
 *    hace a mano, así que el archivo tiene que abrir bien de una.
 *  - Se antepone un apóstrofe a los valores que empiezan con `=`, `+`, `-` o
 *    `@` para evitar inyección de fórmulas (un CSV con `=1+1` ejecutado en Excel
 *    es un vector de ataque real).
 */
export const generarCsv = <T>(filas: T[], columnas: ColumnaCsv<T>[]): string => {
  const escapar = (valor: string | number | null | undefined): string => {
    if (valor === null || valor === undefined) return '';
    let texto = String(valor);
    if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
    if (/[";\n\r]/.test(texto)) texto = `"${texto.replace(/"/g, '""')}"`;
    return texto;
  };

  const lineas = [
    columnas.map((columna) => escapar(columna.encabezado)).join(';'),
    ...filas.map((fila) => columnas.map((columna) => escapar(columna.valor(fila))).join(';')),
  ];

  return `\uFEFF${lineas.join('\r\n')}\r\n`;
};

/** Envía el CSV como descarga con nombre de archivo fechado. */
export const responderCsv = (res: Response, nombreBase: string, contenido: string): void => {
  const fecha = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreBase}-${fecha}.csv"`);
  res.send(contenido);
};
