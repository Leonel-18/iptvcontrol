-- HU-P05 — Convertir cuenta de prueba a permanente.
-- Sólo agrega la acción de auditoría; no toca datos ni columnas.

ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'conversion_cuenta_prueba';
