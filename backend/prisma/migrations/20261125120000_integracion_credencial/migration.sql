-- Credenciales de integración por Empresa Revendedora.
--
-- Una credencial sirve para cualquier API de integración (bot de WhatsApp,
-- Portal de Cliente o futuras). Solo se persiste el hash SHA-256 de la key; el
-- texto plano se muestra una única vez al crearla.

ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'alta_integracion_credencial';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'revocacion_integracion_credencial';
ALTER TYPE "EntidadAuditada" ADD VALUE IF NOT EXISTS 'IntegracionCredencial';

CREATE TABLE "integracion_credencial" (
    "id" UUID NOT NULL,
    "operador_principal_id" UUID NOT NULL,
    "empresa_revendedora_id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "key_prefix" VARCHAR(16) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "team_member_id" UUID,
    "ultimo_uso_en" TIMESTAMP(3),
    "revocado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integracion_credencial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integracion_credencial_key_hash_key"
    ON "integracion_credencial"("key_hash");
CREATE INDEX "integracion_credencial_empresa_revendedora_id_idx"
    ON "integracion_credencial"("empresa_revendedora_id");
CREATE INDEX "integracion_credencial_operador_principal_id_idx"
    ON "integracion_credencial"("operador_principal_id");

ALTER TABLE "integracion_credencial"
    ADD CONSTRAINT "integracion_credencial_operador_principal_id_fkey"
    FOREIGN KEY ("operador_principal_id") REFERENCES "operador_principal"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integracion_credencial"
    ADD CONSTRAINT "integracion_credencial_empresa_revendedora_id_fkey"
    FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integracion_credencial"
    ADD CONSTRAINT "integracion_credencial_team_member_id_fkey"
    FOREIGN KEY ("team_member_id") REFERENCES "team_member"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "integracion_credencial" ENABLE ROW LEVEL SECURITY;

-- El Operador Principal administra las credenciales de sus Empresas; cada
-- Empresa puede consultar las propias.
CREATE POLICY integracion_credencial_tenant ON "integracion_credencial"
    USING (
      (app_is_operator() AND "operador_principal_id" = app_current_operador())
      OR "empresa_revendedora_id" = app_current_tenant()
    )
    WITH CHECK (
      (app_is_operator() AND "operador_principal_id" = app_current_operador())
      OR "empresa_revendedora_id" = app_current_tenant()
    );

-- Bootstrap de autenticación de integraciones: el guard debe resolver la key
-- ANTES de conocer el tenant. Se permite únicamente lectura con el contexto
-- vacío (mismo patrón que team_member para el login).
CREATE POLICY integracion_credencial_bootstrap ON "integracion_credencial"
    FOR SELECT
    USING (
      app_current_tenant() IS NULL
      AND app_current_operador() IS NULL
    );
