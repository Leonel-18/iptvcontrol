-- Plantilla de WhatsApp por Empresa Revendedora (una por tenant) y auditoría.
-- Sólo la Empresa Revendedora dueña lee/edita su plantilla (RLS por tenant).
-- El Operador Principal no accede a estas plantillas: pueden contener datos
-- comerciales propios de cada empresa (docs/04, sección 8).

ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'cambio_plantilla_whatsapp';

CREATE TABLE "plantilla_whatsapp" (
    "id" UUID NOT NULL,
    "empresa_revendedora_id" UUID NOT NULL,
    "contenido" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "actualizado_por_team_member_id" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantilla_whatsapp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plantilla_whatsapp_empresa_revendedora_id_key"
    ON "plantilla_whatsapp"("empresa_revendedora_id");

ALTER TABLE "plantilla_whatsapp"
    ADD CONSTRAINT "plantilla_whatsapp_empresa_revendedora_id_fkey"
    FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "plantilla_whatsapp"
    ADD CONSTRAINT "plantilla_whatsapp_actualizado_por_team_member_id_fkey"
    FOREIGN KEY ("actualizado_por_team_member_id") REFERENCES "team_member"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: cada Empresa Revendedora accede sólo a su propia plantilla.
ALTER TABLE "plantilla_whatsapp" ENABLE ROW LEVEL SECURITY;

CREATE POLICY plantilla_whatsapp_tenant ON "plantilla_whatsapp"
    USING ("empresa_revendedora_id" = app_current_tenant())
    WITH CHECK ("empresa_revendedora_id" = app_current_tenant());
