/**
 * Permisos de una credencial de integración.
 *
 * Son operaciones concretas, no "APIs": una misma credencial puede, por
 * ejemplo, consultar clientes pero no crear cuentas nuevas.
 */
export const PERMISOS_INTEGRACION = [
  'clientes.leer',
  'clientes.crear',
  'clientes.editar',
  'clientes.estado',
  'cuentas.editar',
  'dispositivos.leer',
  'dispositivos.gestionar',
] as const;

export type PermisoIntegracion = (typeof PERMISOS_INTEGRACION)[number];

export const PERMISOS_POR_DEFECTO: PermisoIntegracion[] = [...PERMISOS_INTEGRACION];

/**
 * API de integración que originó el request. Es un dato interno para elegir el
 * fallback de variables de entorno; no limita los permisos de la credencial.
 */
export const SCOPES_INTEGRACION = ['whatsapp_bot', 'portal_cliente'] as const;

export type ScopeIntegracion = (typeof SCOPES_INTEGRACION)[number];
