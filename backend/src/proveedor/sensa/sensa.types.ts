/**
 * Tipos de la API REST de SENSA v4.1.3.
 *
 * Se declaran en inglés porque son el contrato literal del tercero: mantener
 * los nombres tal cual vienen del PDF evita errores de traducción al leer la
 * documentación oficial. La traducción al glosario en español ocurre en el
 * adapter, que es justamente su trabajo.
 */

/** Envoltorio con el que SENSA responde siempre. */
export interface SensaEnvelope<T> {
  code: number;
  code_description: string;
  info: string;
  response: T;
  user_facing_info: string;
}

export interface SensaUser {
  first_name: string;
  last_name: string;
  external_customer_id: string | null;
  dni: string | number;
  address: string;
  city: string;
  mobile_phone: string | number;
  email: string;
  pin: string | number;
  /** Dispositivos "STB Linux" habilitados (0 a 3). No lo usa IPTVControl. */
  auto_provision_count: number;
  /** Dispositivos móviles habilitados (1 a 3) → Dispositivo tipo `movil`. */
  auto_provision_count_mobile: number;
  /** Dispositivos estacionarios (0 a 3) → Dispositivo tipo `fijo`. */
  auto_provision_count_stationary: number;
  /** "A" activo / "I" inactivo. En algunos listados viene como array. */
  status: string | string[];
  services: string;
  start_date: string;
  end_date: string | null;
  vod?: string | string[];
}

export interface SensaAddUserRequest {
  first_name: string;
  last_name: string;
  dni: string;
  external_customer_id?: string;
  email: string;
  mobile_phone: string;
  address: string;
  city: string;
  password: string;
  pin: string;
  services: string;
  /**
   * El PDF los documenta como tipo "int", pero la API de SENSA en producción
   * los valida como string (rechaza con código 707 "Invalid format" si se
   * manda un número JSON sin comillas) — confirmado empíricamente contra el
   * ambiente real. Por eso van tipados `string` acá, aunque representen un
   * número entre 0/1 y 3.
   */
  auto_provision_count: string;
  auto_provision_count_mobile: string;
  auto_provision_count_stationary: string;
  vod?: 'Y' | 'N';
  status?: 'A' | 'I';
}

export type SensaEditUserRequest = Partial<
  Pick<
    SensaAddUserRequest,
    | 'first_name'
    | 'last_name'
    | 'external_customer_id'
    | 'email'
    | 'mobile_phone'
    | 'password'
    | 'pin'
    | 'vod'
    | 'auto_provision_count'
    | 'auto_provision_count_mobile'
    | 'auto_provision_count_stationary'
    | 'status'
  >
>;

export interface SensaDevice {
  device_id: number | string;
  device_type?: string;
  mac?: string;
  model?: string;
  name?: string;
  version?: string;
  status?: string;
  turn_on_date?: string;
}

export interface SensaCreateDeviceRequest {
  customer_id: string;
  mac: string;
}

export interface SensaDeviceEnvelopeResponse {
  customer_id: string;
  device: SensaDevice;
}

export interface SensaUserServicesResponse {
  plan: string;
  services: string;
}

export interface SensaLicensesResponse {
  service_packages_bought: Record<string, number>;
  service_packages_used: Record<string, number>;
}
