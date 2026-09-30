-- HU-D04 — Recordatorios de dispositivos pendientes (Épica D).
-- Guarda cuándo se envió el último recordatorio del evento para respetar la
-- frecuencia configurada sin crear una notificación por cada barrido.

ALTER TABLE "incidencia_dispositivo_proveedor"
  ADD COLUMN "ultimo_recordatorio_en" TIMESTAMP(3);
