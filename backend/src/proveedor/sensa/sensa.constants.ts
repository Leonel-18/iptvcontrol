/**
 * Constantes y códigos de la API REST de SENSA v4.1.3.
 * Fuente: docs/API_Sensa_V4_1_3.pdf (Anexo Tablas).
 */

/** Códigos de error devueltos por SENSA en el campo `code`. */
export const SENSA_CODIGOS = {
  SUCCESS: 200,
  CREATED: 201,

  // Autenticación / autorización
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  URL_NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,

  // Autorización sobre un recurso
  USER_DOES_NOT_BELONG: 601,
  HOTEL_DOES_NOT_BELONG: 602,

  // Validación / request mal formado
  INVALID_CUSTOMER_ID: 701,
  INVALID_CUIT: 702,
  INVALID_PASSWORD: 703,
  WRONG_PARAMETER: 704,
  MISSING_PARAMETER: 705,
  MALFORMED_BODY: 706,
  INVALID_FIELD: 707,
  EMPTY_FIELD: 708,

  // Conflictos de recursos
  USER_ALREADY_EXISTS: 803,
  HOTEL_ALREADY_EXISTS: 804,
  EMAIL_ALREADY_EXISTS: 805,
  DEVICE_ALREADY_EXISTS: 806,
  DEVICE_DOES_NOT_HAVE_CUSTOMER: 807,
  DEVICE_ALREADY_ASSIGNED_TO_USER: 808,
  USER_DATA_WAS_NOT_MODIFIED: 820,
  HOTEL_DATA_WAS_NOT_MODIFIED: 821,

  // No existe
  USER_DOES_NOT_EXIST: 901,
  HOTEL_DOES_NOT_EXIST: 902,
  DEVICE_DOES_NOT_EXIST: 903,

  // Errores de servidor
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,

  // Inconsistencias críticas de middleware/base de datos
  MINERVA_OPERATION_ERROR: 1001,
  MINERVA_USER_EXISTS: 1002,
  SENSA_OPERATION_ERROR: 1003,
} as const;

/**
 * Códigos que significan "el identificador tipo DNI ya está tomado".
 *
 * Es el único error que NO se le muestra al usuario: el sistema incrementa el
 * DNI en 1 y reintenta solo (docs/03_Reglas_de_Negocio.md, secciones 2.3 y 5).
 */
export const CODIGOS_DNI_REPETIDO: number[] = [
  SENSA_CODIGOS.USER_ALREADY_EXISTS,
  SENSA_CODIGOS.MINERVA_USER_EXISTS,
];

/** El email de contacto generado ya existe: se incrementa el correlativo. */
export const CODIGOS_EMAIL_REPETIDO: number[] = [SENSA_CODIGOS.EMAIL_ALREADY_EXISTS];

/** Errores de validación de datos: el reintento automático no sirve. */
export const CODIGOS_VALIDACION: number[] = [
  SENSA_CODIGOS.INVALID_CUSTOMER_ID,
  SENSA_CODIGOS.INVALID_CUIT,
  SENSA_CODIGOS.INVALID_PASSWORD,
  SENSA_CODIGOS.WRONG_PARAMETER,
  SENSA_CODIGOS.MISSING_PARAMETER,
  SENSA_CODIGOS.MALFORMED_BODY,
  SENSA_CODIGOS.INVALID_FIELD,
  SENSA_CODIGOS.EMPTY_FIELD,
];

/** Fallas transitorias: tiene sentido reintentar más tarde (cola de BullMQ). */
export const CODIGOS_TRANSITORIOS: number[] = [
  SENSA_CODIGOS.INTERNAL_ERROR,
  SENSA_CODIGOS.SERVICE_UNAVAILABLE,
  SENSA_CODIGOS.MINERVA_OPERATION_ERROR,
  SENSA_CODIGOS.SENSA_OPERATION_ERROR,
];

/**
 * Códigos de servicio (paquetes de señales) del Anexo de Servicios.
 * El paquete básico "1" es obligatorio y no se puede eliminar.
 */
export const SENSA_SERVICIOS: Record<string, string> = {
  '1': 'Básico',
  '2': 'Hot Pack',
  '3': 'Universal Plus',
  '4': 'Pack Futbol',
  '5': 'HBO Premium',
  '6': 'GOLF TV',
  '7': 'CINDIE',
};

/** Tope de dispositivos por categoría dentro de una Cuenta. */
export const TOPE_DISPOSITIVOS_POR_CATEGORIA = 3;

/** Identificador del conector, coincide con `Proveedor.tipoConector`. */
export const CONECTOR_SENSA = 'sensa';
