/**
 * Tipos de las respuestas del backend.
 *
 * Se escriben a mano en lugar de generarlos del OpenAPI para no meter un paso de
 * build extra en un equipo de un solo desarrollador. Si el contrato crece mucho,
 * el camino natural es generarlos desde `/api/docs-json`.
 *
 * Nota de nomenclatura: las CLAVES respetan lo que devuelve el backend (español,
 * snake_case), mientras que los NOMBRES de los tipos van en inglés genérico, como
 * el resto del frontend.
 */

export type SharedCapacity = 1 | 2;

/**
 * Ocupación de una categoría (fijo o móvil). `tope` es dinámico: en una Cuenta
 * exclusiva siempre es 3; en una compartida refleja los cupos comprometidos
 * por ventas 1+1 o 2+2, hasta 3 por categoría.
 */
export interface CapacityCategory {
  ocupados: number;
  libres: number;
  tope: number;
  cerca_del_tope: boolean;
  resumen: string;
}

/**
 * Ocupación global de la Cuenta. En una exclusiva, `ocupados`/`limite` son
 * Dispositivos (sobre 6 = 3 fijos + 3 móviles). En una compartida son cupos
 * comprometidos por categoría (sobre 3).
 */
export interface AccountCapacity {
  ocupados: number;
  libres: number;
  limite: number;
  cerca_del_tope: boolean;
  resumen: string;
}

export interface Account {
  id: string;
  proveedor_cuenta_id: string | null;
  estado: "activa" | "cerrada";
  es_exclusiva: boolean;
  empresa_revendedora_id: string;
  capacidad: AccountCapacity;
  fijos: CapacityCategory;
  moviles: CapacityCategory;
  creado_en: string;
  // Sólo llegan al panel de la Empresa Revendedora (regla de negocio 4.2).
  usuario?: string;
  password?: string | null;
  pin?: string | null;
  email_contacto?: string;
  servicios?: string;
  servicios_nombres?: string[];
}

export interface AccountDevice {
  id: string;
  cuenta_id: string;
  proveedor_device_id: string | null;
  tipo: "fijo" | "movil" | null;
  tipo_proveedor: string | null;
  estado_vinculacion:
    | "pendiente"
    | "observando"
    | "vinculado"
    | "ambiguo"
    | "expirado"
    | "cancelado";
  estado: "activo" | "bloqueado_por_suspension" | "disponible" | "dado_de_baja";
  creado_en: string;
  cliente_final_id?: string | null;
  cliente_final?: { id: string; numero_cliente: number; nombre: string } | null;
  mac?: string | null;
  nota_descriptiva?: string | null;
  proveedor_cuenta_id?: string | null;
  /**
   * Ventana de vinculación activa (hasta 10 min desde el alta, SENSA se
   * revisa cada 30 s). `null` si ya se vinculó, si venció o si nunca hubo.
   */
  ventana_vinculacion?: { expira_en: string; proximo_sondeo_en?: string } | null;
}

export interface DeviceIncident {
  id: string;
  cuenta_id: string;
  proveedor_device_id: string;
  mac: string | null;
  tipo_proveedor: string | null;
  cantidad_detecciones: number;
  primera_deteccion_en: string;
  ultima_deteccion_en: string;
}

export interface AccountDetail extends Account {
  dispositivos: AccountDevice[];
  clientes_finales?: {
    id: string;
    numero_cliente: number;
    nombre: string;
    dispositivos: number;
  }[];
  /** Sólo llega al panel revendedor para Cuentas compartidas. */
  ventana_curiosidad?: CuriosityWindow | null;
  historial_ventanas_curiosidad?: CuriosityWindow[];
}

export type CuriosityWindowActor =
  | string
  | { id?: string; nombre?: string | null; email?: string | null }
  | null;

export interface CuriosityWindow {
  activa: boolean;
  inicio_en: string;
  fin_previsto_en: string;
  fin_real_en: string | null;
  duracion_predeterminada_minutos: number;
  duracion_aplicada_minutos: number;
  motivo_fin: string | null;
  iniciada_por: CuriosityWindowActor;
  finalizada_por: CuriosityWindowActor;
}

/**
 * Un Dispositivo tal como lo reporta el Proveedor en este momento, clasificado
 * contra lo que IPTVControl conoce (regla 4.2: el Operador no recibe mac ni
 * datos de cliente, así que llegan `undefined` para ese rol).
 */
export interface AccountProviderDevice {
  proveedor_device_id: string;
  mac?: string | null;
  tipo_proveedor?: string | null;
  nombre?: string | null;
  modelo?: string | null;
  activo: boolean;
  ultimo_inicio?: string | null;
  clasificacion: "vinculado" | "reserva_tecnica" | "desconocido";
  dispositivo_id?: string | null;
  cliente_final?: { id: string; numero_cliente: number; nombre: string } | null;
  incidencia_id?: string | null;
  ventana_activa?: boolean;
}

export interface AccountProviderInventory {
  cuenta_id: string;
  proveedor_cuenta_id: string | null;
  limite_dispositivos: number;
  sincronizado_en: string;
  dispositivos: AccountProviderDevice[];
}

export interface AccountCredentials {
  usuario: string;
  password: string | null;
  pin: string | null;
  email_contacto: string;
}

export interface CapacityAlert {
  cuenta_id: string;
  proveedor_cuenta_id: string | null;
  /** Exclusiva: "X de 6" (Dispositivos). Compartida: "X de 3 cupos". */
  dispositivos: string;
  fijos: string;
  moviles: string;
  completa: boolean;
  mensaje: string;
}

export interface Customer {
  id: string;
  numero_cliente: number;
  id_gestion_externo: string | null;
  nombre: string;
  apellido: string | null;
  nombre_completo: string;
  /** Puede venir null en Clientes Finales cargados antes de que este campo existiera. */
  dni: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  tipo_alta: "cuenta_exclusiva" | "dispositivo_compartido";
  estado: "activo" | "suspendido" | "dado_de_baja";
  empresa_revendedora_id: string;
  cantidad_dispositivos: number;
  cuenta_ids: string[];
  suspendido_en: string | null;
  dado_de_baja_en: string | null;
  creado_en: string;
}

export interface CustomerDetail extends Customer {
  cuenta: {
    id: string;
    proveedor_cuenta_id: string | null;
    usuario: string;
    password: string | null;
    pin: string | null;
    email_contacto: string;
    servicios: string;
    servicios_nombres: string[];
    es_exclusiva: boolean;
    capacidad: string | null;
    fijos: string | null;
    moviles: string | null;
    cerca_del_tope: boolean;
  } | null;
  dispositivos: AccountDevice[];
}

/** Vista recortada del Cliente Final para el Operador Principal (regla 4.2). */
export interface CustomerOperatorView {
  id: string;
  numero_cliente: number;
  empresa_revendedora_id: string;
  estado: string;
  tipo_alta: string;
  creado_en: string;
  dispositivos: AccountDevice[];
}

export interface ExternalIdMatch {
  id: string;
  numero_cliente: number;
  nombre: string;
  estado: string;
  dispositivos: number;
}

export interface Reseller {
  id: string;
  razon_social: string;
  cuit: string;
  email_contacto: string;
  telefono_contacto: string;
  contacto: string;
  sitio_web: string | null;
  estado: "activa" | "suspendida";
  modalidad_comercial: {
    id: string;
    tipo: string;
    escala: string;
    precio_por_cuenta: number;
  } | null;
  cantidad_cuentas: number;
  cantidad_clientes: number;
  creado_en: string;
}

export interface ResellerDetail {
  id: string;
  razon_social: string;
  cuit: string;
  direccion: string;
  nombre_contacto: string;
  apellido_contacto: string;
  telefono_contacto: string;
  email_contacto: string;
  sitio_web: string | null;
  estado: "activa" | "suspendida";
  modalidad_comercial: {
    id: string;
    tipo: string;
    escala: string;
    precio_por_cuenta: number;
    ritmo_incremento: number | null;
    tope_cuentas_activas: number | null;
  } | null;
  team_members: {
    id: string;
    email: string;
    rol: string;
    estado: string;
    ultimo_acceso_en: string | null;
  }[];
  resumen: {
    cuentas_activas: number;
    cuentas_cerradas: number;
    dispositivos_activos: number;
    dispositivos_bloqueados: number;
    dispositivos_disponibles: number;
    clientes_activos: number;
  };
  creado_en: string;
}

export interface CommercialPlan {
  id: string;
  tipo: "menudeo" | "obligacion_mensual";
  escala: string;
  precio_por_cuenta: number;
  ritmo_incremento: number | null;
  tope_cuentas_activas: number | null;
  vigente_desde: string;
  vigente_hasta: string | null;
  cantidad_empresas?: number;
}

export interface MyPricing {
  modalidad: CommercialPlan | null;
  cuentas_activas?: number;
  compromiso_del_mes?: number | null;
  cuentas_facturables?: number;
  importe_estimado?: number;
  nota?: string;
  mensaje?: string;
}

export interface TeamMember {
  id: string;
  email: string;
  nombre: string | null;
  rol:
    "operator_admin" | "operator_staff" | "reseller_admin" | "reseller_staff";
  estado: "invitado" | "activo" | "inactivo";
  empresa_revendedora: { id: string; razon_social: string } | null;
  es_del_operador: boolean;
  ultimo_acceso_en: string | null;
  creado_en: string;
}

export interface InvitationResult {
  enviada: boolean;
  team_member_id?: string;
  url_invitacion?: string;
  expira_en_segundos?: number;
  motivo?: string;
}

export interface AuditEntry {
  id: string;
  accion: string;
  accion_etiqueta: string;
  entidad: string;
  entidad_id: string | null;
  empresa_revendedora: { id: string; razon_social: string } | null;
  ejecutado_por: {
    id: string;
    email: string;
    nombre: string | null;
    rol: string;
  } | null;
  detalle: Record<string, unknown> | null;
  creado_en: string;
}

export interface IntegrationHealth {
  ventana: string;
  llamadas_exitosas: number;
  llamadas_fallidas: number;
  tasa_exito: number | null;
  ultima_exitosa: {
    operacion: string;
    duracion_ms: number;
    fecha: string;
  } | null;
  ultimas_fallidas: {
    operacion: string;
    codigo: number | null;
    mensaje: string | null;
    duracion_ms: number;
    fecha: string;
  }[];
  cola_reintentos: {
    pendientes: number;
    activos: number;
    fallidos: number;
    demorados: number;
    disponible: boolean;
  };
  estado_general: "ok" | "atencion" | "critico";
}

export interface OperatorDashboard {
  rol: "operator";
  cuentas: {
    total: number;
    vendidas: number;
    disponibles: number;
    bloqueadas: number;
  };
  dispositivos: { activos: number; bloqueados: number; disponibles: number };
  empresas_revendedoras: { activas: number; suspendidas: number };
  clientes_finales: {
    activos: number;
    suspendidos: number;
    dados_de_baja: number;
  };
  salud_integracion: IntegrationHealth;
}

export interface ResellerDashboard {
  rol: "reseller";
  cuentas: { activas: number; cerradas: number };
  dispositivos: {
    activos: number;
    activos_fijos: number;
    activos_moviles: number;
    bloqueados: number;
    disponibles: number;
  };
  clientes_finales: {
    activos: number;
    suspendidos: number;
    dados_de_baja: number;
  };
  modalidad_comercial: {
    tipo: string;
    escala: string;
    precio_por_cuenta: number;
  } | null;
  alertas_capacidad: CapacityAlert[];
}

export type Dashboard = OperatorDashboard | ResellerDashboard;

export interface ProviderSettings {
  configurada: boolean;
  server: string | null;
  port: number | null;
  usuario: string | null;
  token_cargado: boolean;
  token_pista: string | null;
  proveedor: string | null;
  ciudad_por_defecto: string | null;
  servicios_por_defecto: string | null;
  dni_inicial_sensa: number;
  dni_actual_sensa: number;
  umbral_alerta_capacidad: number;
  max_reintentos_dni: number;
  url_base: string | null;
}

export interface CuriosityWindowSettings {
  duracion_predeterminada_minutos: number;
}

export interface ConnectionTest {
  ok: boolean;
  mensaje: string;
  latencia_ms: number;
  codigo: number | null;
  probado_en: string;
}

export interface Provider {
  id: string;
  nombre: string;
  tipo_conector: string;
  activo: boolean;
  configurado: boolean;
}

export interface ServiceCatalogItem {
  codigo: string;
  nombre: string;
  obligatorio: boolean;
  contratado: boolean;
  nota?: string;
}

export interface LicenseReport {
  disponible: boolean;
  motivo?: string;
  consultado_en?: string;
  detalle?: {
    codigo: string;
    paquete: string;
    compradas: number;
    usadas: number;
    disponibles: number;
  }[];
}

export interface ConsumptionReport {
  generado_en: string;
  nota: string;
  filas: {
    empresa_revendedora_id: string;
    razon_social: string;
    cuit: string;
    estado: string;
    modalidad: string | null;
    escala: string | null;
    precio_por_cuenta: number | null;
    meses_vigencia: number;
    cuentas_activas: number;
    cuentas_en_uso: number;
    cuentas_comprometidas: number | null;
    cuentas_facturables: number;
    importe_estimado: number | null;
    dispositivos_activos: number;
    clientes_activos: number;
    cuentas_sin_usar: number | null;
  }[];
  totales: {
    cuentas_activas: number;
    cuentas_en_uso: number;
    cuentas_facturables: number;
    importe_estimado: number;
    dispositivos_activos: number;
    clientes_activos: number;
  };
}
