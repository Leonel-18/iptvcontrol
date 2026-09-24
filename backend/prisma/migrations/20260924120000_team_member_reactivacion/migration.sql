-- Reactivación y baja definitiva de Team Members.
-- Nuevas acciones de auditoría para trazar ambos movimientos (regla 11).
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'reactivacion_team_member';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'baja_definitiva_team_member';
