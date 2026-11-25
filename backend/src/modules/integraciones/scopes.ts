/**
 * API de integración que originó el request. Es un dato interno para elegir el
 * fallback de variables de entorno; la credencial de la Empresa habilita todas
 * las APIs por igual.
 */
export const SCOPES_INTEGRACION = ['whatsapp_bot', 'portal_cliente'] as const;

export type ScopeIntegracion = (typeof SCOPES_INTEGRACION)[number];
