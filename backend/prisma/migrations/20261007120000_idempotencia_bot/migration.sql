CREATE TYPE "EstadoIdempotenciaBot" AS ENUM ('procesando', 'completada', 'fallida');

CREATE TABLE "solicitud_idempotencia_bot" (
    "id" UUID NOT NULL,
    "empresa_revendedora_id" UUID NOT NULL,
    "clave" VARCHAR(128) NOT NULL,
    "hash_solicitud" CHAR(64) NOT NULL,
    "estado" "EstadoIdempotenciaBot" NOT NULL,
    "respuesta_cifrada" TEXT,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_en" TIMESTAMP(3),

    CONSTRAINT "solicitud_idempotencia_bot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "solicitud_idempotencia_bot_empresa_revendedora_id_clave_key"
    ON "solicitud_idempotencia_bot"("empresa_revendedora_id", "clave");
CREATE INDEX "solicitud_idempotencia_bot_empresa_revendedora_id_creada_en_idx"
    ON "solicitud_idempotencia_bot"("empresa_revendedora_id", "creada_en");

ALTER TABLE "solicitud_idempotencia_bot"
    ADD CONSTRAINT "solicitud_idempotencia_bot_empresa_revendedora_id_fkey"
    FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "solicitud_idempotencia_bot" ENABLE ROW LEVEL SECURITY;

CREATE POLICY solicitud_idempotencia_bot_tenant ON "solicitud_idempotencia_bot"
    USING ("empresa_revendedora_id" = app_current_tenant())
    WITH CHECK ("empresa_revendedora_id" = app_current_tenant());

DO $$
DECLARE
  app_user TEXT := COALESCE(NULLIF(current_setting('app.app_db_user', TRUE), ''), 'iptvcontrol_app');
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_user) THEN
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "solicitud_idempotencia_bot" TO %I',
      app_user
    );
  END IF;
END $$;
