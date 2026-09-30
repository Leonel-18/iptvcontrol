-- HU-N02 — Configuración de notificaciones por Empresa Revendedora (Épica C).
-- Preferencias de avisos internos: dispositivos pendientes y ventana de alta por
-- vencer. Los hitos de cuentas de prueba reutilizan `pruebas_avisos_dias`.

ALTER TABLE "empresa_revendedora"
  ADD COLUMN "notif_dispositivos" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notif_dispositivos_frecuencia_horas" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "notif_ventana_alta" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notif_ventana_alta_dias" INTEGER[] NOT NULL DEFAULT ARRAY[3, 1];

ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'cambio_configuracion_notificaciones';
