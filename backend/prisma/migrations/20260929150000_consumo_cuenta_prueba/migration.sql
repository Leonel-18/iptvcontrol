-- HU-P02 — Cupo mensual y cuentas extra.
--
-- 1) Período al que pertenecen los extras configurados. Los extras sólo aplican
--    al mes vigente: al cambiar de mes dejan de contar solos, sin necesidad de un
--    job.
-- 2) Registro append-only de consumo de pruebas: una fila por prueba creada. Es
--    la fuente del contador mensual, deliberadamente independiente del estado
--    actual de la Cuenta, para que borrar o convertir una prueba no devuelva cupo.

ALTER TABLE "empresa_revendedora"
  ADD COLUMN "pruebas_extras_periodo_ref" TEXT;

CREATE TABLE "consumo_cuenta_prueba" (
    "id" UUID NOT NULL,
    "empresa_revendedora_id" UUID NOT NULL,
    "cuenta_id" UUID,
    "consumida_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumo_cuenta_prueba_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consumo_cuenta_prueba_empresa_revendedora_id_consumida_en_idx"
    ON "consumo_cuenta_prueba"("empresa_revendedora_id", "consumida_en");

ALTER TABLE "consumo_cuenta_prueba"
    ADD CONSTRAINT "consumo_cuenta_prueba_empresa_revendedora_id_fkey"
    FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: cada Empresa Revendedora ve y escribe su propio consumo; el Operador
-- Principal puede consultarlo para las Empresas de su operador.
ALTER TABLE "consumo_cuenta_prueba" ENABLE ROW LEVEL SECURITY;

CREATE POLICY consumo_cuenta_prueba_tenant ON "consumo_cuenta_prueba"
  USING (
    "empresa_revendedora_id" = app_current_tenant()
    OR (
      app_is_operator()
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "consumo_cuenta_prueba"."empresa_revendedora_id"
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
        WHERE er."id" = "consumo_cuenta_prueba"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
  );

DO $$
DECLARE
  app_user text := COALESCE(NULLIF(current_setting('app.app_db_user', TRUE), ''), 'iptvcontrol_app');
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_user) THEN
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "consumo_cuenta_prueba" TO %I', app_user);
  END IF;
END
$$;
