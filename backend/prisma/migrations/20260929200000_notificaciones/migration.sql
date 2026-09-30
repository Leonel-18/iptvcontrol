-- HU-N01 — Centro de notificaciones persistentes (Épica C).
--
-- `notificacion` es del tenant (todos los Team Members de la Empresa Revendedora
-- la ven). `notificacion_lectura` guarda el estado leído/no leído por Team Member,
-- con quién y cuándo. RLS por tenant; el Operador Principal no las usa.

CREATE TYPE "TipoNotificacion" AS ENUM (
  'prueba_por_vencer',
  'ventana_alta_por_vencer',
  'dispositivo_pendiente'
);

CREATE TYPE "AccionNotificacion" AS ENUM ('ver_cuenta');

CREATE TABLE "notificacion" (
    "id" UUID NOT NULL,
    "empresa_revendedora_id" UUID NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "accion_tipo" "AccionNotificacion",
    "accion_ref_id" UUID,
    "clave" VARCHAR(200),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notificacion_empresa_revendedora_id_clave_key"
    ON "notificacion"("empresa_revendedora_id", "clave");
CREATE INDEX "notificacion_empresa_revendedora_id_creado_en_idx"
    ON "notificacion"("empresa_revendedora_id", "creado_en");

ALTER TABLE "notificacion"
    ADD CONSTRAINT "notificacion_empresa_revendedora_id_fkey"
    FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notificacion_lectura" (
    "id" UUID NOT NULL,
    "notificacion_id" UUID NOT NULL,
    "team_member_id" UUID NOT NULL,
    "empresa_revendedora_id" UUID NOT NULL,
    "leido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_lectura_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notificacion_lectura_notificacion_id_team_member_id_key"
    ON "notificacion_lectura"("notificacion_id", "team_member_id");
CREATE INDEX "notificacion_lectura_team_member_id_idx"
    ON "notificacion_lectura"("team_member_id");
CREATE INDEX "notificacion_lectura_empresa_revendedora_id_idx"
    ON "notificacion_lectura"("empresa_revendedora_id");

ALTER TABLE "notificacion_lectura"
    ADD CONSTRAINT "notificacion_lectura_notificacion_id_fkey"
    FOREIGN KEY ("notificacion_id") REFERENCES "notificacion"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notificacion_lectura"
    ADD CONSTRAINT "notificacion_lectura_team_member_id_fkey"
    FOREIGN KEY ("team_member_id") REFERENCES "team_member"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notificacion_lectura"
    ADD CONSTRAINT "notificacion_lectura_empresa_revendedora_id_fkey"
    FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: cada Empresa Revendedora accede sólo a sus notificaciones. El Operador
-- Principal puede escribir/leer las de sus Empresas (por si un job lo necesita).
ALTER TABLE "notificacion" ENABLE ROW LEVEL SECURITY;

CREATE POLICY notificacion_tenant ON "notificacion"
    USING (
      "empresa_revendedora_id" = app_current_tenant()
      OR (
        app_is_operator()
        AND EXISTS (
          SELECT 1 FROM "empresa_revendedora" er
          WHERE er."id" = "notificacion"."empresa_revendedora_id"
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
          WHERE er."id" = "notificacion"."empresa_revendedora_id"
            AND er."operador_principal_id" = app_current_operador()
        )
      )
    );

ALTER TABLE "notificacion_lectura" ENABLE ROW LEVEL SECURITY;

CREATE POLICY notificacion_lectura_tenant ON "notificacion_lectura"
    USING (
      "empresa_revendedora_id" = app_current_tenant()
      OR (
        app_is_operator()
        AND EXISTS (
          SELECT 1 FROM "empresa_revendedora" er
          WHERE er."id" = "notificacion_lectura"."empresa_revendedora_id"
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
          WHERE er."id" = "notificacion_lectura"."empresa_revendedora_id"
            AND er."operador_principal_id" = app_current_operador()
        )
      )
    );

DO $$
DECLARE
  app_user text := COALESCE(NULLIF(current_setting('app.app_db_user', TRUE), ''), 'iptvcontrol_app');
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_user) THEN
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "notificacion", "notificacion_lectura" TO %I', app_user);
  END IF;
END
$$;
