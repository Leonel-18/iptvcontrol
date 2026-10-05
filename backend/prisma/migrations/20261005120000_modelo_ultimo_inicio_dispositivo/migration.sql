ALTER TABLE "dispositivo"
  ADD COLUMN "modelo" VARCHAR(200),
  ADD COLUMN "ultimo_inicio" TIMESTAMP(3);

ALTER TABLE "incidencia_dispositivo_proveedor"
  ADD COLUMN "modelo" VARCHAR(200),
  ADD COLUMN "ultimo_inicio" TIMESTAMP(3);
