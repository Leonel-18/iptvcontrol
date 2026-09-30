-- HU-P03 — Crear cuenta de prueba.
--
-- Marca de prueba sobre la Cuenta: fecha de creación y vencimiento quedan
-- congelados al crear la prueba (la duración configurada sólo aplica a pruebas
-- nuevas). El cierre automático por vencimiento llega en HU-P06.

ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'creacion_cuenta_prueba';

ALTER TABLE "cuenta"
  ADD COLUMN "es_prueba" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "prueba_creada_en" TIMESTAMP(3),
  ADD COLUMN "prueba_vence_en" TIMESTAMP(3);
