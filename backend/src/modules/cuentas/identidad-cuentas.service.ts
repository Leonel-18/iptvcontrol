import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import { existsSync, statSync } from 'fs';
import { resolve, join } from 'path';
import * as XLSX from 'xlsx';

export interface IdentidadFicticia {
  nombre: string;
  apellido: string;
}

/**
 * =============================================================================
 * Identidad de las Cuentas nuevas en el Proveedor
 * =============================================================================
 * Las Cuentas COMPARTIDAS no representan a una persona real: IPTVControl le
 * inventa a SENSA una identidad (nombre y apellido sacados al azar del Excel
 * `Nombres.xlsx` de la raíz del proyecto y un DNI aleatorio). El Cliente Final
 * local conserva los datos que cargó el vendedor; la identidad ficticia sólo
 * viaja al Proveedor.
 *
 * El Excel se cachea en memoria y se recarga si cambia (mtime), para no leerlo
 * en cada alta.
 * =============================================================================
 */
@Injectable()
export class IdentidadCuentasService {
  private readonly logger = new Logger(IdentidadCuentasService.name);
  private cache: { mtimeMs: number; nombres: string[]; apellidos: string[] } | null = null;

  /** DNI ficticio para Cuentas compartidas: 10.000.000 a 99.000.000 inclusive. */
  static readonly DNI_MINIMO = 10_000_000;
  static readonly DNI_MAXIMO = 99_000_000;

  /** Nombre del archivo de identidades en la raíz del proyecto. */
  static readonly ARCHIVO_DEFAULT = 'Nombres.xlsx';

  /** Devuelve nombre y apellido aleatorios del Excel (columnas Nombres/Apellidos). */
  async elegirIdentidad(): Promise<IdentidadFicticia> {
    const { nombres, apellidos } = this.leerListas();
    if (nombres.length === 0 || apellidos.length === 0) {
      throw new Error(
        'El archivo de identidades no tiene nombres o apellidos cargados. Revise Nombres.xlsx.',
      );
    }
    return {
      nombre: nombres[randomInt(nombres.length)],
      apellido: apellidos[randomInt(apellidos.length)],
    };
  }

  /** DNI aleatorio dentro del rango admitido (siempre 8 dígitos). */
  dniAleatorio(): string {
    return String(randomInt(IdentidadCuentasService.DNI_MINIMO, IdentidadCuentasService.DNI_MAXIMO + 1));
  }

  /** Ruta del Excel: variable de entorno o raíz del proyecto (backend/../). */
  private rutaArchivo(): string {
    const env = process.env.NOMBRES_XLSX_PATH;
    const candidatos = env
      ? [env]
      : [join(process.cwd(), IdentidadCuentasService.ARCHIVO_DEFAULT), resolve(process.cwd(), '..', IdentidadCuentasService.ARCHIVO_DEFAULT)];
    const ruta = candidatos.find((c) => existsSync(c));
    if (!ruta) {
      throw new Error(
        `No se encontró ${IdentidadCuentasService.ARCHIVO_DEFAULT} en la raíz del proyecto ` +
          '(ni en NOMBRES_XLSX_PATH). La identidad de las Cuentas compartidas depende de ese archivo.',
      );
    }
    return ruta;
  }

  private leerListas(): { nombres: string[]; apellidos: string[] } {
    const ruta = this.rutaArchivo();
    const mtimeMs = statSync(ruta).mtimeMs;
    if (this.cache && this.cache.mtimeMs === mtimeMs) {
      return { nombres: this.cache.nombres, apellidos: this.cache.apellidos };
    }

    const libro = XLSX.readFile(ruta);
    const hoja = libro.Sheets[libro.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' });
    const nombres: string[] = [];
    const apellidos: string[] = [];

    for (const fila of filas) {
      const nombre = String(fila['Nombres'] ?? '').trim();
      const apellido = String(fila['Apellidos'] ?? '').trim();
      if (nombre) nombres.push(nombre);
      if (apellido) apellidos.push(apellido);
    }

    if (nombres.length === 0 && apellidos.length === 0) {
      throw new Error(
        'El archivo de identidades no tiene las columnas esperadas "Nombres" y "Apellidos".',
      );
    }
    this.logger.log(
      `Identidades cargadas: ${nombres.length} nombres y ${apellidos.length} apellidos.`,
    );
    this.cache = { mtimeMs, nombres, apellidos };
    return { nombres, apellidos };
  }
}
