-- =============================================================================
-- Corrección de la política RLS de `team_member`
-- =============================================================================
-- Problema que resuelve: el Operador Principal tiene que poder crear, leer y
-- reenviar la invitación del `reseller_admin` de cada Empresa Revendedora
-- (docs/04_Esqueleto_Tecnico_Inicial.md, sección 4.7 — el login propio de la
-- Empresa Revendedora forma parte del alcance del MVP).
--
-- La política original sólo contemplaba tres casos:
--   1. Team Member del propio Operador  (operador_principal_id = operador actual)
--   2. Team Member del propio tenant    (empresa_revendedora_id = tenant actual)
--   3. Bootstrap de autenticación       (sin contexto)
--
-- Pero un `reseller_admin` se guarda con `operador_principal_id = NULL` y
-- `empresa_revendedora_id = <empresa>`, y cuando lo crea un `operator_admin` el
-- contexto es "operador, sin tenant". Ninguna de las tres ramas aplicaba, así
-- que el INSERT lo rechazaba la base: la Empresa Revendedora quedaba sin acceso.
--
-- Se agrega la cuarta rama, que es la que faltaba: el Operador Principal alcanza
-- los Team Members de las Empresas Revendedoras **que le pertenecen**. El
-- aislamiento se mantiene — una Empresa Revendedora sigue viendo sólo los suyos,
-- y un Operador Principal no alcanza los de las empresas de otro Operador.
-- =============================================================================

DROP POLICY IF EXISTS team_member_tenant ON "team_member";

CREATE POLICY team_member_tenant ON "team_member"
  USING (
    -- Team Members del propio Operador Principal
    (app_is_operator() AND "operador_principal_id" = app_current_operador())
    -- Team Members de la propia Empresa Revendedora
    OR "empresa_revendedora_id" = app_current_tenant()
    -- Team Members de las Empresas Revendedoras del propio Operador Principal
    OR (
      app_is_operator()
      AND "empresa_revendedora_id" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "team_member"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
    -- Bootstrap de autenticación: sin contexto de tenant seteado, se permite la
    -- lectura para resolver el usuario del token. Es el único caso donde
    -- app.current_tenant y app.current_operador están ambos vacíos.
    OR (app_current_tenant() IS NULL AND app_current_operador() IS NULL)
  )
  WITH CHECK (
    (app_is_operator() AND "operador_principal_id" = app_current_operador())
    OR "empresa_revendedora_id" = app_current_tenant()
    OR (
      app_is_operator()
      AND "empresa_revendedora_id" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "team_member"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
    OR (app_current_tenant() IS NULL AND app_current_operador() IS NULL)
  );
