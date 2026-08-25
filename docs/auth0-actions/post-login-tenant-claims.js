/**
 * Auth0 Action — Post Login: claims de tenant en el JWT
 * ══════════════════════════════════════════════════════
 * VERSIÓN ACTUALIZADA (18/08/2026)
 *
 * QUÉ CAMBIÓ RESPECTO DE LA VERSIÓN ANTERIOR
 * ───────────────────────────────────────────
 * La Action anterior leía `tenant_id` / `tenant_type` del `app_metadata`.
 * Ese esquema quedó desalineado con lo que IPTVControl escribe realmente en
 * Auth0 al invitar un Team Member (vía `Auth0ManagementService.crearInvitacion`),
 * que genera:
 *
 *   {
 *     "rol": "reseller_admin" | "operator_admin" | ...,
 *     "empresa_revendedora_id": "<uuid>" | "",
 *     "operador_principal_id": "<uuid>" | ""
 *   }
 *
 * Por eso cualquier invitación nueva creada desde el panel quedaba bloqueada
 * ("access_denied") hasta cargar `tenant_id`/`tenant_type` a mano — un paso
 * manual que la operación diaria no puede sostener.
 *
 * Esta versión deriva `tenant_id`/`tenant_type` a partir de los campos que el
 * sistema SÍ escribe (rol + ids), así:
 *   - `reseller_admin`/`reseller_staff` → tenant_type = "REVENDEDORA", tenant_id = empresa_revendedora_id
 *   - `operator_admin`/`operator_staff` → tenant_type = "OPERADOR", tenant_id = operador_principal_id
 *
 * Los claims custom siguen siendo los mismos que consume el resto del stack:
 *
 *   https://iptvcontrol/tenant_id    → UUID de Empresa Revendedora u Operador Principal
 *   https://iptvcontrol/tenant_type  → "OPERADOR" | "REVENDEDORA"
 *
 * NOTA IMPORTANTE SOBRE EL BACKEND
 * ────────────────────────────────
 * El backend NO resuelve el tenant por estos claims: `JwtStrategy.validate()`
 * devuelve el payload tal cual, y `TeamMemberGuard` busca el Team Member en la
 * tabla `team_member` por `sub` (el id del usuario en Auth0). La base de datos
 * es la fuente de verdad de tenant + rol. Esta Action solamente expone esos
 * valores como claims custom (potencialmente útiles a futuro, y para que el
 * frontend pueda distinguir panel de Operador vs. panel de Revendedora).
 *
 * INSTALACIÓN (dashboard de Auth0)
 * ────────────────────────────────
 *   1. Auth0 Dashboard → Actions → Library → "IPTVControl - Tenant Claims"
 *   2. Reemplazar el código por el de este archivo → Deploy.
 *   3. Actions → Flows → Login → asegurarse de que la Action está en el flujo → Apply.
 */

exports.onExecutePostLogin = async (event, api) => {
  const NAMESPACE = 'https://iptvcontrol';
  const metadata = event.user.app_metadata || {};

  const rol = metadata.rol;

  let tenantId;
  let tenantType;

  if (rol === 'reseller_admin' || rol === 'reseller_staff') {
    tenantId = metadata.empresa_revendedora_id;
    tenantType = 'REVENDEDORA';
  } else if (rol === 'operator_admin' || rol === 'operator_staff') {
    tenantId = metadata.operador_principal_id;
    tenantType = 'OPERADOR';
  }

  // Falla cerrada (deny by default): sin tenant asignado no entra nadie,
  // en vez de emitir un token de acceso con datos a medias.
  if (!tenantId || !tenantType) {
    api.access.deny(
      'Tu usuario todavía no tiene una Empresa Revendedora u Operador Principal asignado. Comunicate con el operador.',
    );
    return;
  }

  if (tenantType !== 'OPERADOR' && tenantType !== 'REVENDEDORA') {
    api.access.deny(
      `tenant_type inválido en app_metadata: "${tenantType}". Debe ser OPERADOR o REVENDEDORA.`,
    );
    return;
  }

  api.accessToken.setCustomClaim(`${NAMESPACE}/tenant_id`, tenantId);
  api.accessToken.setCustomClaim(`${NAMESPACE}/tenant_type`, tenantType);

  api.idToken.setCustomClaim(`${NAMESPACE}/tenant_id`, tenantId);
  api.idToken.setCustomClaim(`${NAMESPACE}/tenant_type`, tenantType);
};