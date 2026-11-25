/**
 * Alcances de las credenciales de integración.
 *
 * Una credencial puede habilitar una o varias APIs. Por defecto se otorgan
 * todas, para que la misma key sirva en cualquier integración de la Empresa.
 */
export const SCOPES_INTEGRACION = ['whatsapp_bot', 'portal_cliente'] as const;

export type ScopeIntegracion = (typeof SCOPES_INTEGRACION)[number];

export const SCOPES_POR_DEFECTO: ScopeIntegracion[] = [...SCOPES_INTEGRACION];
