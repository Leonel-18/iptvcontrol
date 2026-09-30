-- HU-P07 — Auditoría del ciclo de cuentas de prueba.
-- Agrega la acción para el cierre MANUAL de una cuenta de prueba (distinguible de
-- la conversión y de la creación). El cierre automático por vencimiento y su
-- fallo los agrega HU-P06. No toca datos ni columnas.

ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'cierre_cuenta_prueba';
