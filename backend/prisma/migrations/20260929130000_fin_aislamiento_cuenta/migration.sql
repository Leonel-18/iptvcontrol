-- HU-A03 — Fin del aislamiento de una Cuenta (vencimiento automático o revocación manual).
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'fin_aislamiento_cuenta';
