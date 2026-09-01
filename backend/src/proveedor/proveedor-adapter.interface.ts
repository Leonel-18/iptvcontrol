/**
 * =============================================================================
 * ProveedorAdapter — contrato único de integración con el Proveedor de contenido
 * =============================================================================
 * Este es el patrón central del sistema (docs/04_Esqueleto_Tecnico_Inicial.md,
 * sección 3): la lógica de negocio de IPTVControl NUNCA le habla directo a la
 * API de SENSA. Habla contra esta interfaz.
 *
 *   [Lógica de negocio]  →  [ProveedorAdapter]  →  [SensaAdapter]
 *
 * Por qué importa: el día que se sume otro Proveedor de contenido, se escribe un
 * adapter nuevo y el núcleo del sistema no se toca. Es el mismo criterio con el
 * que un ISP no cablea la lógica de facturación a un modelo puntual de OLT.
 *
 * Toda operación recibe las credenciales de forma explícita, en vez de leerlas
 * de una variable global: así el adapter queda sin estado y puede servir a
 * varios Operadores Principales (multi-distribuidor) sin mezclar credenciales.
 * =============================================================================
 */

/** Datos de conexión a la API del Proveedor, ya descifrados. */
export interface CredencialesProveedor {
  server: string;
  port: number;
  usuario: string;
  /** Token en claro. Se descifra sólo en memoria, nunca se loguea. */
  token: string;
}

/** Datos necesarios para crear una Cuenta en el Proveedor. */
export interface CrearCuentaParams {
  /** Identificador tipo DNI generado por IPTVControl (7 u 8 dígitos). */
  dni: string;
  email: string;
  /** Contraseña numérica (8 a 20 dígitos). */
  password: string;
  /** PIN de control parental (4 a 8 dígitos). */
  pin: string;
  nombre: string;
  apellido: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  /** Parametrización de contenido, ej. "1|3|5". */
  servicios: string;
  /** Límite comercial de cupos por categoría de la Cuenta. */
  limiteDispositivos: number;
  /** Proyección técnica para Proveedores que separan categorías. */
  dispositivosFijos: number;
  dispositivosMoviles: number;
  /** Identificador propio para cruce de datos (external_customer_id). */
  referenciaExterna?: string;
}

/** Estado de una Cuenta tal como lo reporta el Proveedor. */
export interface CuentaProveedor {
  proveedorCuentaId: string;
  dni: string;
  email: string;
  servicios: string;
  dispositivosFijos: number;
  dispositivosMoviles: number;
  activa: boolean;
}

/** Cuenta incluida en el inventario general del Proveedor. */
export interface CuentaInventarioProveedor {
  proveedorCuentaId: string;
  dni: string;
  nombre: string;
  apellido: string;
  email: string;
  ciudad: string;
  referenciaExterna?: string;
  activa: boolean;
}

export interface ActualizarCapacidadParams {
  proveedorCuentaId: string;
  limiteDispositivos?: number;
  dispositivosFijos: number;
  dispositivosMoviles: number;
}

export interface ActualizarPasswordParams {
  proveedorCuentaId: string;
  /** Contraseña numérica (8 a 20 dígitos), igual que en el alta. */
  password: string;
}

export interface ActualizarServiciosParams {
  proveedorCuentaId: string;
  /** Firma canónica de servicios, ej. "1|3|5". */
  servicios: string;
}

export interface ActivarDispositivoParams {
  proveedorCuentaId: string;
  /** MAC de 12 dígitos hexadecimales. Si no se informa, el dispositivo se
   *  auto-provisiona al iniciar sesión y se captura después por polling. */
  mac?: string;
}

/** Dispositivo tal como lo reporta el Proveedor. */
export interface DispositivoProveedor {
  proveedorDeviceId: string;
  /** Identificador informado por el Proveedor; puede tener hasta 40 caracteres. */
  mac?: string;
  nombre?: string;
  modelo?: string;
  tipo?: string;
  activo: boolean;
  ultimoInicio?: string;
}

export interface ResultadoPrueba {
  ok: boolean;
  mensaje: string;
  latenciaMs: number;
  /** Código devuelto por el Proveedor, si respondió. */
  codigo?: number;
}

export interface LicenciasProveedor {
  /** Licencias contratadas por servicio: { "1": 240, "2": 150, ... } */
  compradas: Record<string, number>;
  /** Licencias en uso por servicio. */
  usadas: Record<string, number>;
}

export interface ServiciosCuenta {
  plan: string;
  servicios: string;
}

/**
 * Operaciones que cualquier Proveedor de contenido debe soportar para que
 * IPTVControl pueda operar sobre él.
 */
export interface ProveedorAdapter {
  /** Identificador del conector, coincide con `Proveedor.tipoConector`. */
  readonly tipoConector: string;

  /** Verifica que la API del Proveedor responda (botón "Probar conexión"). */
  probarConexion(credenciales: CredencialesProveedor): Promise<ResultadoPrueba>;

  /**
   * Crea una Cuenta nueva. Si el Proveedor rechaza el identificador por estar
   * repetido, debe lanzar `DniRepetidoError` para que la capa de negocio
   * incremente el número y reintente (reglas de negocio, 2.3).
   */
  crearCuenta(
    credenciales: CredencialesProveedor,
    params: CrearCuentaParams,
  ): Promise<CuentaProveedor>;

  /** Lista el inventario completo de Cuentas administradas por el Proveedor. */
  listarCuentas(credenciales: CredencialesProveedor): Promise<CuentaInventarioProveedor[]>;

  /** Actualiza la cantidad de dispositivos habilitados de una Cuenta. */
  actualizarCapacidadDispositivos(
    credenciales: CredencialesProveedor,
    params: ActualizarCapacidadParams,
  ): Promise<void>;

  /**
   * Cambia manualmente la contraseña de la Cuenta. La generada en el alta
   * sigue siendo automática; esto es una corrección puntual para cuando la
   * Empresa Revendedora necesita definir una a mano (ej. no se pudo comunicar
   * la generada, o el Cliente Final ya tenía una acordada de antes).
   */
  actualizarPassword(
    credenciales: CredencialesProveedor,
    params: ActualizarPasswordParams,
  ): Promise<void>;

  /** Actualiza la parametrización de contenido (servicios) de una Cuenta. */
  actualizarServicios(
    credenciales: CredencialesProveedor,
    params: ActualizarServiciosParams,
  ): Promise<void>;

  /** Da de alta/activa un dispositivo dentro de una Cuenta. */
  activarDispositivo(
    credenciales: CredencialesProveedor,
    params: ActivarDispositivoParams,
  ): Promise<DispositivoProveedor | null>;

  /** Elimina un dispositivo del Proveedor. */
  eliminarDispositivo(
    credenciales: CredencialesProveedor,
    proveedorDeviceId: string,
  ): Promise<void>;

  /** Reasigna un dispositivo existente a otra Cuenta (migración de Cuenta). */
  reasignarDispositivo(
    credenciales: CredencialesProveedor,
    params: { mac: string; proveedorCuentaId: string },
  ): Promise<DispositivoProveedor>;

  /** Lista los dispositivos de una Cuenta (usado por el polling). */
  listarDispositivos(
    credenciales: CredencialesProveedor,
    proveedorCuentaId: string,
  ): Promise<DispositivoProveedor[]>;

  /** Consulta el estado de una Cuenta. Devuelve null si no existe. */
  consultarCuenta(
    credenciales: CredencialesProveedor,
    proveedorCuentaId: string,
  ): Promise<CuentaProveedor | null>;

  /** Consulta la parametrización de contenido vigente de una Cuenta. */
  consultarServicios(
    credenciales: CredencialesProveedor,
    proveedorCuentaId: string,
  ): Promise<ServiciosCuenta>;

  /** Cierra/elimina una Cuenta en el Proveedor. */
  cerrarCuenta(credenciales: CredencialesProveedor, proveedorCuentaId: string): Promise<void>;

  /** Licencias contratadas vs. usadas (reporte de consumo). */
  consultarLicencias(credenciales: CredencialesProveedor): Promise<LicenciasProveedor>;
}

/** Token de inyección para la lista de adapters registrados. */
export const PROVEEDOR_ADAPTERS = Symbol('PROVEEDOR_ADAPTERS');
