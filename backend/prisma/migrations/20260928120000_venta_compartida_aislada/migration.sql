-- "Aislar Cuenta": marca la venta compartida que forzó una Cuenta nueva
-- dedicada (para que un prospecto pruebe solo, sin compartir con otros).
ALTER TABLE "venta_compartida" ADD COLUMN "aislada" BOOLEAN NOT NULL DEFAULT false;
