-- HU-A02 — Aislamiento de una Cuenta compartida existente.
-- Estado de aislamiento a nivel Cuenta (no confundir con la Ventana de Alta).
ALTER TABLE "cuenta"
  ADD COLUMN "aislada" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aislamiento_fin_en" TIMESTAMP(3);

-- Auditoría: apertura de aislamiento de Cuenta.
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'apertura_aislamiento_cuenta';

-- Motivo por el que se cierra una Ventana de Alta vigente al aislar la Cuenta.
ALTER TYPE "MotivoFinVentanaCuriosidad" ADD VALUE IF NOT EXISTS 'reemplazo_por_aislamiento';
