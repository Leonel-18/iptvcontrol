-- HU-P01 — Habilitación y parametrización de cuentas de prueba por Empresa Revendedora.
ALTER TABLE "empresa_revendedora"
  ADD COLUMN "pruebas_habilitadas" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pruebas_cupo_mensual" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pruebas_duracion_dias" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pruebas_extras_periodo" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pruebas_avisos_dias" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
