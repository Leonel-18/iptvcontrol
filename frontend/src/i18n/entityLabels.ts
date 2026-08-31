/**
 * =============================================================================
 * entityLabels.ts — la capa de traducción español ↔ inglés
 * =============================================================================
 * IPTVControl usa dos vocabularios a propósito
 * (AGENTS.md → "Terminología: español en backend, inglés en frontend"):
 *
 *   - **Backend, base de datos y documentación**: glosario oficial en español
 *     (`Cuenta`, `Dispositivo`, `Cliente Final`, `Empresa Revendedora`).
 *   - **Rutas y componentes del frontend**: nombres genéricos en inglés
 *     (`/customers`, `/devices`, `CustomerForm`).
 *
 * Este archivo es el ÚNICO lugar donde se cruzan. La regla práctica: si estás por
 * escribir un texto en español dentro de un componente para nombrar una entidad
 * o un estado, el texto va acá y el componente lo consume desde acá. Así el
 * mapeo no depende de la memoria de cada dev
 * (docs/IPTVControl_URL_Routing_Convention.md, sección 4.2).
 * =============================================================================
 */

/** Nombre de cada entidad, en singular y plural, tal como lo ve el usuario. */
export const entityLabels = {
  reseller: {
    singular: "Empresa Revendedora",
    plural: "Empresas Revendedoras",
  },
  account: { singular: "Cuenta", plural: "Cuentas" },
  customer: { singular: "Cliente Final", plural: "Clientes Finales" },
  device: { singular: "Dispositivo", plural: "Dispositivos" },
  commercialPlan: {
    singular: "Modalidad comercial",
    plural: "Modalidades comerciales",
  },
  provider: { singular: "Proveedor", plural: "Proveedores" },
  teamMember: { singular: "Miembro del equipo", plural: "Equipo" },
  auditLog: {
    singular: "Registro de auditoría",
    plural: "Registro de auditoría",
  },
  operator: {
    singular: "Operador Principal",
    plural: "Operadores Principales",
  },
} as const;

/** Títulos de las secciones del menú. */
export const navLabels = {
  dashboard: "Inicio",
  resellers: "Empresas Revendedoras",
  accounts: "Cuentas",
  customers: "Clientes",
  devices: "Dispositivos",
  commercialPlans: "Planes comerciales",
  providers: "Proveedores",
  reports: "Reportes",
  auditLog: "Auditoría",
  teamMembers: "Equipo",
  settings: "Configuración",
} as const;

/** Estados de Cuenta. */
export const accountStatusLabels: Record<string, string> = {
  activa: "Activa",
  cerrada: "Cerrada",
};

/** Estados de Cliente Final. */
export const customerStatusLabels: Record<string, string> = {
  activo: "Activo",
  suspendido: "Suspendido",
  dado_de_baja: "Dado de baja",
};

/**
 * Estados de Dispositivo.
 *
 * `bloqueado_por_suspension` se muestra como "Bloqueado" con una explicación
 * aparte: es el estado que más confunde, porque el dispositivo está liberado en
 * el proveedor pero reservado para su titular suspendido.
 */
export const deviceStatusLabels: Record<string, string> = {
  activo: "Activo",
  bloqueado_por_suspension: "Bloqueado",
  disponible: "Disponible",
  dado_de_baja: "Dado de baja",
};

export const deviceStatusHelp: Record<string, string> = {
  activo: "En uso por un Cliente Final.",
  bloqueado_por_suspension:
    "Liberado en el proveedor pero reservado para su cliente suspendido. No se puede asignar a otro cliente hasta que ese cliente pase a baja definitiva.",
  disponible:
    "Liberado por una baja definitiva. Se puede asignar a un cliente nuevo.",
  dado_de_baja: "Fuera de servicio.",
};

export const deviceBindingLabels: Record<string, string> = {
  pendiente: "Pendiente",
  observando: "Esperando inicio",
  vinculado: "Vinculado",
  ambiguo: "Revisión necesaria",
  expirado: "Vinculación vencida",
  cancelado: "Cancelado",
};

export const deviceBindingHelp: Record<string, string> = {
  pendiente: "Todavía no comenzó la detección en el Proveedor.",
  observando: "La ventana está abierta y espera el primer inicio de sesión.",
  vinculado: "El Dispositivo ya fue identificado en el Proveedor.",
  ambiguo:
    "Se detectó más de un candidato. La Empresa Revendedora debe elegir el correcto.",
  expirado: "No se detectó ningún equipo durante la ventana de vinculación.",
  cancelado: "La vinculación fue cancelada.",
};

/** Clasificación de un Dispositivo reportado por el Proveedor al sincronizar. */
export const providerDeviceClassLabels: Record<string, string> = {
  vinculado: "Vinculado a una venta",
  desconocido: "No autorizado",
};

export const providerDeviceClassHelp: Record<string, string> = {
  vinculado:
    "Corresponde a un Dispositivo vendido y registrado en IPTVControl.",
  desconocido:
    "No es un Dispositivo vendido conocido. Puede ser un inicio de sesión con las credenciales " +
    "compartidas por fuera de una venta (ej. reproductor web). Revíselo antes de eliminarlo.",
};

/**
 * Tipos de Dispositivo. El tope depende del modo de la Cuenta: 1+1 o 2+2 por
 * venta compartida, o hasta 3 fijos + 3 móviles en una Cuenta exclusiva.
 */
export const deviceTypeLabels: Record<string, string> = {
  fijo: "Fijo",
  movil: "Móvil",
};

export const deviceTypeHelp: Record<string, string> = {
  fijo: "Android TV, Roku, Amazon Fire TV o Apple TV.",
  movil: "Celular, tablet o PC/navegador.",
};

/** Métodos de alta de Cliente Final. */
export const customerIntakeLabels: Record<string, string> = {
  cuenta_exclusiva: "Cuenta completa exclusiva",
  dispositivo_compartido: "Venta en cuenta compartida",
};

export const customerIntakeHelp: Record<string, string> = {
  cuenta_exclusiva:
    "Se crea una Cuenta nueva para este cliente, con todos los servicios contratados y hasta 3 fijos + 3 móviles.",
  dispositivo_compartido:
    "Reserva 1+1 o 2+2 Dispositivos, en una Cuenta compartida sólo con ventas de exactamente la misma selección de servicios.",
};

export const sharedCapacityLabels = {
  1: "1 fijo + 1 móvil",
  2: "2 fijos + 2 móviles",
} as const;

/** Modalidades comerciales. */
export const commercialPlanTypeLabels: Record<string, string> = {
  menudeo: "Al menudeo",
  obligacion_mensual: "Con obligación mensual",
};

export const commercialPlanTypeHelp: Record<string, string> = {
  menudeo: "Se factura únicamente por las cuentas efectivamente utilizadas.",
  obligacion_mensual:
    "Compromiso mínimo mensual creciente y acumulativo. Las cuentas comprometidas se facturan se usen o no; las no usadas quedan disponibles para el mes siguiente.",
};

/** Estados de Empresa Revendedora. */
export const resellerStatusLabels: Record<string, string> = {
  activa: "Activa",
  suspendida: "Suspendida",
};

/** Roles de Team Member. */
export const roleLabels: Record<string, string> = {
  operator_admin: "Administrador del operador",
  operator_staff: "Equipo del operador",
  reseller_admin: "Administrador de la empresa",
  reseller_staff: "Equipo de la empresa",
};

export const teamMemberStatusLabels: Record<string, string> = {
  invitado: "Invitado",
  activo: "Activo",
  inactivo: "Inactivo",
};

/** Entidades del registro de auditoría. */
export const auditEntityLabels: Record<string, string> = {
  ClienteFinal: "Cliente Final",
  Dispositivo: "Dispositivo",
  Cuenta: "Cuenta",
  EmpresaRevendedora: "Empresa Revendedora",
  ModalidadComercial: "Modalidad comercial",
  ConfiguracionProveedor: "Configuración del proveedor",
  TeamMember: "Miembro del equipo",
};

/** Semáforo de la salud de la integración con el proveedor. */
export const healthStatusLabels: Record<string, string> = {
  ok: "Todo en orden",
  atencion: "Requiere atención",
  critico: "Con problemas",
};

/** Traducción laxa con fallback al valor técnico, para no mostrar vacíos. */
export const traducir = (
  diccionario: Record<string, string>,
  valor?: string | null,
): string => {
  if (!valor) return "—";
  return diccionario[valor] ?? valor;
};
