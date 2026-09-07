-- Auditoría del cambio manual de PIN de una Cuenta.

ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'cambio_pin_cuenta';
