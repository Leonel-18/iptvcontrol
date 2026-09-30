-- HU-N05 — Preferencia individual de sonido de notificaciones (Épica C).
-- Es por Team Member (usuario), no por Empresa Revendedora.

ALTER TABLE "team_member"
  ADD COLUMN "sonido_notificaciones" BOOLEAN NOT NULL DEFAULT true;
