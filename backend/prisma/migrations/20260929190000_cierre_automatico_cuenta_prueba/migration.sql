-- HU-P06 — Vencimiento automático de cuentas de prueba.
-- Agrega las acciones de auditoría del cierre automático por vencimiento y de su
-- fallo (el proceso reintenta en el próximo barrido). No toca datos ni columnas.

ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'cierre_automatico_cuenta_prueba';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'fallo_cierre_cuenta_prueba';
