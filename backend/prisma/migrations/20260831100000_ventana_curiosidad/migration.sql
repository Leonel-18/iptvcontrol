ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'apertura_ventana_curiosidad';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'levantamiento_ventana_curiosidad';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'cambio_configuracion_ventana_curiosidad';
ALTER TYPE "EntidadAuditada" ADD VALUE IF NOT EXISTS 'VentanaCuriosidad';

CREATE TYPE "MotivoFinVentanaCuriosidad" AS ENUM (
  'vencimiento',
  'levantamiento_manual',
  'cancelacion_venta'
);

ALTER TABLE "empresa_revendedora"
  ADD COLUMN "duracion_ventana_curiosidad_minutos" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "empresa_revendedora_duracion_ventana_curiosidad_check"
    CHECK ("duracion_ventana_curiosidad_minutos" >= 0);

CREATE TABLE "ventana_curiosidad" (
  "id" UUID NOT NULL,
  "cuenta_id" UUID NOT NULL,
  "cliente_final_id" UUID NOT NULL,
  "empresa_revendedora_id" UUID NOT NULL,
  "venta_compartida_id" UUID,
  "inicio_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "duracion_predeterminada_minutos" INTEGER NOT NULL,
  "duracion_aplicada_minutos" INTEGER NOT NULL,
  "fin_previsto_en" TIMESTAMP(3) NOT NULL,
  "fin_real_en" TIMESTAMP(3),
  "motivo_fin" "MotivoFinVentanaCuriosidad",
  "iniciada_por_team_member_id" UUID,
  "finalizada_por_team_member_id" UUID,
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ventana_curiosidad_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ventana_curiosidad_duraciones_check" CHECK (
    "duracion_predeterminada_minutos" >= 0
    AND "duracion_aplicada_minutos" >= 0
    AND "duracion_aplicada_minutos" <= "duracion_predeterminada_minutos"
  ),
  CONSTRAINT "ventana_curiosidad_fechas_check" CHECK (
    "fin_previsto_en" >= "inicio_en"
    AND ("fin_real_en" IS NULL OR "fin_real_en" >= "inicio_en")
  )
);

CREATE UNIQUE INDEX "ventana_curiosidad_venta_compartida_id_key"
  ON "ventana_curiosidad"("venta_compartida_id");
CREATE UNIQUE INDEX "ventana_curiosidad_cuenta_abierta_key"
  ON "ventana_curiosidad"("cuenta_id") WHERE "fin_real_en" IS NULL;
CREATE INDEX "ventana_curiosidad_empresa_revendedora_id_inicio_en_idx"
  ON "ventana_curiosidad"("empresa_revendedora_id", "inicio_en");
CREATE INDEX "ventana_curiosidad_cuenta_id_fin_real_en_fin_previsto_en_idx"
  ON "ventana_curiosidad"("cuenta_id", "fin_real_en", "fin_previsto_en");
CREATE INDEX "ventana_curiosidad_cliente_final_id_idx"
  ON "ventana_curiosidad"("cliente_final_id");

ALTER TABLE "ventana_curiosidad"
  ADD CONSTRAINT "ventana_curiosidad_cuenta_id_fkey"
  FOREIGN KEY ("cuenta_id") REFERENCES "cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ventana_curiosidad"
  ADD CONSTRAINT "ventana_curiosidad_cliente_final_id_fkey"
  FOREIGN KEY ("cliente_final_id") REFERENCES "cliente_final"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ventana_curiosidad"
  ADD CONSTRAINT "ventana_curiosidad_empresa_revendedora_id_fkey"
  FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ventana_curiosidad"
  ADD CONSTRAINT "ventana_curiosidad_venta_compartida_id_fkey"
  FOREIGN KEY ("venta_compartida_id") REFERENCES "venta_compartida"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ventana_curiosidad"
  ADD CONSTRAINT "ventana_curiosidad_iniciada_por_team_member_id_fkey"
  FOREIGN KEY ("iniciada_por_team_member_id") REFERENCES "team_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ventana_curiosidad"
  ADD CONSTRAINT "ventana_curiosidad_finalizada_por_team_member_id_fkey"
  FOREIGN KEY ("finalizada_por_team_member_id") REFERENCES "team_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ventana_curiosidad" ENABLE ROW LEVEL SECURITY;

CREATE POLICY ventana_curiosidad_tenant ON "ventana_curiosidad"
  USING (
    (
      "empresa_revendedora_id" = app_current_tenant()
      OR (
        app_is_operator()
        AND EXISTS (
          SELECT 1 FROM "empresa_revendedora" er
          WHERE er."id" = "ventana_curiosidad"."empresa_revendedora_id"
            AND er."operador_principal_id" = app_current_operador()
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM "cuenta" c
      WHERE c."id" = "ventana_curiosidad"."cuenta_id"
        AND c."empresa_revendedora_id" = "ventana_curiosidad"."empresa_revendedora_id"
    )
    AND EXISTS (
      SELECT 1 FROM "cliente_final" cf
      WHERE cf."id" = "ventana_curiosidad"."cliente_final_id"
        AND cf."empresa_revendedora_id" = "ventana_curiosidad"."empresa_revendedora_id"
    )
  )
  WITH CHECK (
    (
      "empresa_revendedora_id" = app_current_tenant()
      OR (
        app_is_operator()
        AND EXISTS (
          SELECT 1 FROM "empresa_revendedora" er
          WHERE er."id" = "ventana_curiosidad"."empresa_revendedora_id"
            AND er."operador_principal_id" = app_current_operador()
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM "cuenta" c
      WHERE c."id" = "ventana_curiosidad"."cuenta_id"
        AND c."empresa_revendedora_id" = "ventana_curiosidad"."empresa_revendedora_id"
    )
    AND EXISTS (
      SELECT 1 FROM "cliente_final" cf
      WHERE cf."id" = "ventana_curiosidad"."cliente_final_id"
        AND cf."empresa_revendedora_id" = "ventana_curiosidad"."empresa_revendedora_id"
    )
  );

DO $$
DECLARE
  app_user text := COALESCE(NULLIF(current_setting('app.app_db_user', TRUE), ''), 'iptvcontrol_app');
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_user) THEN
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ventana_curiosidad" TO %I', app_user);
  END IF;
END
$$;
