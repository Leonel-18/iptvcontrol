-- CreateTable
CREATE TABLE "venta_compartida" (
    "id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "cliente_final_id" UUID NOT NULL,
    "empresa_revendedora_id" UUID NOT NULL,
    "cupos_por_categoria" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venta_compartida_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "venta_compartida_cupos_check" CHECK ("cupos_por_categoria" IN (1, 2))
);

ALTER TABLE "solicitud_vinculacion_dispositivo"
  ADD COLUMN "crea_venta_compartida" BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: cada Cliente Final que ya ocupa una Cuenta compartida conserva el
-- contrato histórico de 1 fijo + 1 móvil.
INSERT INTO "venta_compartida" (
  "id",
  "cuenta_id",
  "cliente_final_id",
  "empresa_revendedora_id",
  "cupos_por_categoria"
)
SELECT
  gen_random_uuid(),
  d."cuenta_id",
  d."cliente_final_id",
  d."empresa_revendedora_id",
  1
FROM "dispositivo" d
JOIN "cuenta" c ON c."id" = d."cuenta_id"
WHERE c."es_exclusiva" = FALSE
  AND d."cliente_final_id" IS NOT NULL
  AND d."estado" IN ('activo', 'bloqueado_por_suspension')
GROUP BY d."cuenta_id", d."cliente_final_id", d."empresa_revendedora_id";

-- Una ventana compartida que ya estaba abierta al desplegar creó la venta sólo
-- si el Cliente Final todavía no tenía otro equipo vinculado en esa Cuenta.
UPDATE "solicitud_vinculacion_dispositivo" s
SET "crea_venta_compartida" = TRUE
FROM "dispositivo" d, "cuenta" c
WHERE s."dispositivo_id" = d."id"
  AND c."id" = s."cuenta_id"
  AND c."es_exclusiva" = FALSE
  AND s."estado" IN ('pendiente', 'observando')
  AND d."cliente_final_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "dispositivo" previo
    WHERE previo."cuenta_id" = d."cuenta_id"
      AND previo."cliente_final_id" = d."cliente_final_id"
      AND previo."id" <> d."id"
      AND previo."estado" IN ('activo', 'bloqueado_por_suspension')
      AND previo."proveedor_device_id" IS NOT NULL
  );

-- CreateIndex
CREATE UNIQUE INDEX "venta_compartida_cuenta_id_cliente_final_id_key"
  ON "venta_compartida"("cuenta_id", "cliente_final_id");
CREATE INDEX "venta_compartida_empresa_revendedora_id_idx"
  ON "venta_compartida"("empresa_revendedora_id");
CREATE INDEX "venta_compartida_cuenta_id_idx" ON "venta_compartida"("cuenta_id");
CREATE INDEX "venta_compartida_cliente_final_id_idx" ON "venta_compartida"("cliente_final_id");

-- AddForeignKey
ALTER TABLE "venta_compartida"
  ADD CONSTRAINT "venta_compartida_cuenta_id_fkey"
  FOREIGN KEY ("cuenta_id") REFERENCES "cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "venta_compartida"
  ADD CONSTRAINT "venta_compartida_cliente_final_id_fkey"
  FOREIGN KEY ("cliente_final_id") REFERENCES "cliente_final"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "venta_compartida"
  ADD CONSTRAINT "venta_compartida_empresa_revendedora_id_fkey"
  FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security
ALTER TABLE "venta_compartida" ENABLE ROW LEVEL SECURITY;

CREATE POLICY venta_compartida_tenant ON "venta_compartida"
  USING (
    (
      "empresa_revendedora_id" = app_current_tenant()
      OR (
        app_is_operator()
        AND EXISTS (
          SELECT 1 FROM "empresa_revendedora" er
          WHERE er."id" = "venta_compartida"."empresa_revendedora_id"
            AND er."operador_principal_id" = app_current_operador()
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM "cuenta" c
      WHERE c."id" = "venta_compartida"."cuenta_id"
        AND c."empresa_revendedora_id" = "venta_compartida"."empresa_revendedora_id"
    )
    AND EXISTS (
      SELECT 1 FROM "cliente_final" cf
      WHERE cf."id" = "venta_compartida"."cliente_final_id"
        AND cf."empresa_revendedora_id" = "venta_compartida"."empresa_revendedora_id"
    )
  )
  WITH CHECK (
    (
      "empresa_revendedora_id" = app_current_tenant()
      OR (
        app_is_operator()
        AND EXISTS (
          SELECT 1 FROM "empresa_revendedora" er
          WHERE er."id" = "venta_compartida"."empresa_revendedora_id"
            AND er."operador_principal_id" = app_current_operador()
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM "cuenta" c
      WHERE c."id" = "venta_compartida"."cuenta_id"
        AND c."empresa_revendedora_id" = "venta_compartida"."empresa_revendedora_id"
    )
    AND EXISTS (
      SELECT 1 FROM "cliente_final" cf
      WHERE cf."id" = "venta_compartida"."cliente_final_id"
        AND cf."empresa_revendedora_id" = "venta_compartida"."empresa_revendedora_id"
    )
  );

-- Permisos del usuario de aplicación. El rol puede no existir fuera de Docker.
DO $$
DECLARE
  app_user text := COALESCE(NULLIF(current_setting('app.app_db_user', TRUE), ''), 'iptvcontrol_app');
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_user) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_user);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "venta_compartida" TO %I', app_user);
  END IF;
END
$$;
