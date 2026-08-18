-- =============================================================================
-- Row-Level Security — segunda capa de aislamiento multi-tenant
-- =============================================================================
-- La primera capa es el scope por tenant en la capa de aplicación (middleware
-- NestJS + servicios). Esta es la red de contención: si algún día una query se
-- escribe sin el filtro correcto, Postgres igual no devuelve filas de otra
-- Empresa Revendedora.
--
-- Analogía de telecom: es el equivalente a separar clientes por VLAN además de
-- filtrarlos por ACL en el router. Si falla la ACL, la VLAN sigue conteniendo.
--
-- Cómo se activa el contexto por request (ver PrismaService):
--   SELECT set_config('app.current_tenant',   '<empresa_revendedora_id>', TRUE);
--   SELECT set_config('app.current_operador', '<operador_principal_id>',  TRUE);
--   SELECT set_config('app.is_operator',      'on' | 'off',               TRUE);
--
-- El tercer parámetro TRUE hace que el valor sea local a la transacción, así no
-- se filtra entre requests que reutilizan la misma conexión del pool.
--
-- IMPORTANTE: el owner de las tablas ignora RLS. Por eso la aplicación se
-- conecta con APP_DB_USER (sin BYPASSRLS) y las migraciones con el owner.
-- Ver docker/postgres/init/01-app-user.sh
-- =============================================================================

-- Funciones auxiliares -------------------------------------------------------

CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_tenant', TRUE), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_current_operador() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_operador', TRUE), '')::uuid;
$$ LANGUAGE sql STABLE;

-- true cuando el request lo ejecuta un Team Member del Operador Principal.
CREATE OR REPLACE FUNCTION app_is_operator() RETURNS boolean AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_operator', TRUE), ''), 'off') = 'on';
$$ LANGUAGE sql STABLE;

-- Habilitación de RLS --------------------------------------------------------

ALTER TABLE "empresa_revendedora" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cliente_final"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cuenta"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dispositivo"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_member"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "modalidad_comercial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "configuracion_proveedor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "llamada_proveedor"   ENABLE ROW LEVEL SECURITY;

-- Empresa Revendedora --------------------------------------------------------
-- El Operador Principal ve las Empresas Revendedoras de su propio Operador.
-- Cada Empresa Revendedora se ve únicamente a sí misma.
CREATE POLICY empresa_revendedora_tenant ON "empresa_revendedora"
  USING (
    (app_is_operator() AND "operador_principal_id" = app_current_operador())
    OR "id" = app_current_tenant()
  )
  WITH CHECK (
    (app_is_operator() AND "operador_principal_id" = app_current_operador())
    OR "id" = app_current_tenant()
  );

-- Cliente Final --------------------------------------------------------------
-- Nota: el Operador Principal SÍ puede alcanzar las filas (necesita contar y
-- referenciar por ID para soporte), pero la capa de aplicación nunca serializa
-- nombre ni datos de contacto hacia su panel (reglas de negocio, 4.2).
CREATE POLICY cliente_final_tenant ON "cliente_final"
  USING (
    "empresa_revendedora_id" = app_current_tenant()
    OR (
      app_is_operator()
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "cliente_final"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
  )
  WITH CHECK ("empresa_revendedora_id" = app_current_tenant());

-- Cuenta ---------------------------------------------------------------------
CREATE POLICY cuenta_tenant ON "cuenta"
  USING (
    "empresa_revendedora_id" = app_current_tenant()
    OR (
      app_is_operator()
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "cuenta"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
  )
  WITH CHECK (
    "empresa_revendedora_id" = app_current_tenant()
    OR (
      app_is_operator()
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "cuenta"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
  );

-- Dispositivo ----------------------------------------------------------------
CREATE POLICY dispositivo_tenant ON "dispositivo"
  USING (
    "empresa_revendedora_id" = app_current_tenant()
    OR (
      app_is_operator()
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "dispositivo"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
  )
  WITH CHECK (
    "empresa_revendedora_id" = app_current_tenant()
    OR (
      app_is_operator()
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "dispositivo"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
  );

-- Team Member ----------------------------------------------------------------
-- Cada Team Member sólo ve los de su propio tenant. El login (búsqueda por
-- auth0_user_id antes de tener contexto) se hace con un cliente sin contexto,
-- amparado por la política de bootstrap de abajo.
CREATE POLICY team_member_tenant ON "team_member"
  USING (
    (app_is_operator() AND "operador_principal_id" = app_current_operador())
    OR "empresa_revendedora_id" = app_current_tenant()
    -- Bootstrap de autenticación: sin contexto de tenant seteado, se permite
    -- la lectura para resolver el usuario del token. Es el único caso donde
    -- app.current_tenant y app.current_operador están ambos vacíos.
    OR (app_current_tenant() IS NULL AND app_current_operador() IS NULL)
  )
  WITH CHECK (
    (app_is_operator() AND "operador_principal_id" = app_current_operador())
    OR "empresa_revendedora_id" = app_current_tenant()
    OR (app_current_tenant() IS NULL AND app_current_operador() IS NULL)
  );

-- Audit Log ------------------------------------------------------------------
CREATE POLICY audit_log_tenant ON "audit_log"
  USING (
    (app_is_operator() AND "operador_principal_id" = app_current_operador())
    OR "empresa_revendedora_id" = app_current_tenant()
  )
  WITH CHECK (
    (app_is_operator() AND "operador_principal_id" = app_current_operador())
    OR "empresa_revendedora_id" = app_current_tenant()
  );

-- Modalidad Comercial --------------------------------------------------------
-- Lectura: la Empresa Revendedora necesita ver los precios vigentes que le
-- corresponden a ella (reglas de negocio, 1.3), por eso puede leer las
-- modalidades de su propio Operador Principal. Escritura: sólo el Operador.
CREATE POLICY modalidad_comercial_read ON "modalidad_comercial"
  FOR SELECT
  USING (
    (app_is_operator() AND "operador_principal_id" = app_current_operador())
    OR EXISTS (
      SELECT 1 FROM "empresa_revendedora" er
      WHERE er."id" = app_current_tenant()
        AND er."operador_principal_id" = "modalidad_comercial"."operador_principal_id"
    )
  );

CREATE POLICY modalidad_comercial_write ON "modalidad_comercial"
  FOR ALL
  USING (app_is_operator() AND "operador_principal_id" = app_current_operador())
  WITH CHECK (app_is_operator() AND "operador_principal_id" = app_current_operador());

-- Configuración del Proveedor ------------------------------------------------
-- Exclusiva del Operador Principal. Una Empresa Revendedora no ve datos del
-- Operador Principal (reglas de negocio, sección 4).
CREATE POLICY configuracion_proveedor_operador ON "configuracion_proveedor"
  USING (app_is_operator() AND "operador_principal_id" = app_current_operador())
  WITH CHECK (app_is_operator() AND "operador_principal_id" = app_current_operador());

-- Llamadas al Proveedor (panel de salud) -------------------------------------
CREATE POLICY llamada_proveedor_operador ON "llamada_proveedor"
  USING (app_is_operator() AND "operador_principal_id" = app_current_operador())
  WITH CHECK (TRUE);

-- Permisos del usuario de aplicación -----------------------------------------
-- Se otorgan sobre lo ya creado por esta migración. El rol puede no existir en
-- entornos donde no se usó docker/postgres/init (ej. una DB gestionada), por
-- eso el bloque es tolerante a su ausencia.
DO $$
DECLARE
  app_user text := COALESCE(NULLIF(current_setting('app.app_db_user', TRUE), ''), 'iptvcontrol_app');
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_user) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_user);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', app_user);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', app_user);
  END IF;
END
$$;
