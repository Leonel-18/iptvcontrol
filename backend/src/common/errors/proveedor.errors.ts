import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Mensaje que se le muestra al usuario cuando la API del Proveedor falla o está
 * caída. Texto textual pedido en docs/03_Reglas_de_Negocio.md, sección 5.
 */
export const MENSAJE_PROVEEDOR_CAIDO =
  'Intente nuevamente más tarde, sistema congestionado, comuníquese con el operador';

/**
 * Error genérico de integración con el Proveedor.
 *
 * Se traduce a HTTP 503 con el mensaje de negocio. El detalle técnico queda en
 * `detalleTecnico` para los logs y el panel de salud, y nunca se le muestra al
 * usuario final — no le aporta y puede exponer información de la integración.
 */
export class ProveedorNoDisponibleError extends HttpException {
  constructor(
    readonly detalleTecnico: string,
    readonly operacion?: string,
    readonly codigoProveedor?: number,
  ) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: MENSAJE_PROVEEDOR_CAIDO,
        error: 'ProveedorNoDisponible',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * El Proveedor rechazó el alta porque el identificador tipo DNI ya existe.
 *
 * Caso especial: NO se le muestra al usuario. El sistema incrementa el DNI en 1
 * y reintenta automáticamente (reglas de negocio, 2.3 y 5).
 */
export class DniRepetidoError extends Error {
  constructor(readonly dniIntentado: string) {
    super(`El Proveedor rechazó el DNI ${dniIntentado} por estar repetido.`);
    this.name = 'DniRepetidoError';
  }
}

/**
 * El email de contacto generado ya existe en el Proveedor. Se resuelve igual
 * que el DNI repetido: se incrementa el correlativo del email y se reintenta.
 */
export class EmailRepetidoError extends Error {
  constructor(readonly emailIntentado: string) {
    super(`El Proveedor rechazó el email ${emailIntentado} por estar repetido.`);
    this.name = 'EmailRepetidoError';
  }
}

/**
 * Se agotaron los reintentos de generación de DNI. Caso límite que sigue
 * pendiente de definición formal (docs/05_Decisiones_Pendientes.md, sección 4):
 * por ahora se corta con un error explícito y queda registrado, en lugar de
 * reintentar indefinidamente contra la API del Proveedor.
 */
export class ReintentosDniAgotadosError extends HttpException {
  constructor(readonly intentos: number) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: MENSAJE_PROVEEDOR_CAIDO,
        error: 'ReintentosDniAgotados',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/** Error de validación devuelto por el Proveedor (dato mal formado, etc.). */
export class ProveedorValidacionError extends HttpException {
  constructor(
    readonly detalleTecnico: string,
    readonly codigoProveedor?: number,
    mensajeUsuario?: string,
  ) {
    super(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        message:
          mensajeUsuario ??
          'El proveedor rechazó la operación por un dato inválido. Revise los datos e intente nuevamente.',
        error: 'ProveedorValidacion',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
