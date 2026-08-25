-- CreateEnum
CREATE TYPE "EstadoVinculacionDispositivo" AS ENUM ('pendiente', 'observando', 'vinculado', 'ambiguo', 'expirado', 'cancelado');

-- CreateEnum
CREATE TYPE "EstadoReservaTecnica" AS ENUM ('activa', 'liberada', 'error');

-- CreateEnum
CREATE TYPE "EstadoSolicitudVinculacion" AS ENUM ('pendiente', 'observando', 'vinculado', 'ambiguo', 'expirado', 'cancelado');

-- CreateEnum
CREATE TYPE "EstadoIncidenciaDispositivo" AS ENUM ('pendiente', 'reconocido', 'eliminacion_pendiente', 'resuelto');

-- AlterEnum
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'apertura_vinculacion_dispositivo';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'vinculacion_dispositivo';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'vinculacion_ambigua';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'alta_reserva_tecnica';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'liberacion_reserva_tecnica';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'deteccion_dispositivo_no_autorizado';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'resolucion_incidencia_dispositivo';

-- AlterEnum
ALTER TYPE "EntidadAuditada" ADD VALUE IF NOT EXISTS 'SolicitudVinculacionDispositivo';
ALTER TYPE "EntidadAuditada" ADD VALUE IF NOT EXISTS 'ReservaTecnicaDispositivo';
ALTER TYPE "EntidadAuditada" ADD VALUE IF NOT EXISTS 'IncidenciaDispositivoProveedor';

-- AlterTable
ALTER TABLE "cuenta"
  ADD COLUMN "limite_dispositivos" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "dispositivo"
  ALTER COLUMN "tipo" DROP NOT NULL,
  ADD COLUMN "tipo_proveedor" VARCHAR(40),
  ADD COLUMN "estado_vinculacion" "EstadoVinculacionDispositivo" NOT NULL DEFAULT 'pendiente';

-- Backfill de los Dispositivos que ya fueron detectados por el Proveedor.
UPDATE "dispositivo"
SET "estado_vinculacion" = 'vinculado'
WHERE "proveedor_device_id" IS NOT NULL;

-- CreateTable
CREATE TABLE "reserva_tecnica_dispositivo" (
    "id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "empresa_revendedora_id" UUID NOT NULL,
    "proveedor_device_id" VARCHAR(60),
    "mac" VARCHAR(12) NOT NULL,
    "estado" "EstadoReservaTecnica" NOT NULL DEFAULT 'activa',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reserva_tecnica_dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_vinculacion_dispositivo" (
    "id" UUID NOT NULL,
    "dispositivo_id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "empresa_revendedora_id" UUID NOT NULL,
    "estado" "EstadoSolicitudVinculacion" NOT NULL DEFAULT 'pendiente',
    "baseline_device_ids" JSONB NOT NULL,
    "proveedor_device_id_candidato" VARCHAR(60),
    "abierta_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "proximo_sondeo_en" TIMESTAMP(3) NOT NULL,
    "ultimo_sondeo_en" TIMESTAMP(3),
    "cantidad_intentos" INTEGER NOT NULL DEFAULT 0,
    "motivo_ambiguedad" VARCHAR(300),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitud_vinculacion_dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidencia_dispositivo_proveedor" (
    "id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "empresa_revendedora_id" UUID NOT NULL,
    "proveedor_device_id" VARCHAR(60) NOT NULL,
    "mac" VARCHAR(12),
    "tipo_proveedor" VARCHAR(40),
    "estado" "EstadoIncidenciaDispositivo" NOT NULL DEFAULT 'pendiente',
    "cantidad_detecciones" INTEGER NOT NULL DEFAULT 1,
    "primera_deteccion_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_deteccion_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resuelta_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidencia_dispositivo_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Deduplicación previa por seguridad: si hubo reconciliaciones paralelas en
-- datos históricos, el mismo proveedor_device_id puede existir más de una vez
-- en la misma Cuenta. Se conserva la fila más reciente y se elimina el resto,
-- para que el índice único no falle en bases con historial.
DELETE FROM "dispositivo" d
USING "dispositivo" anterior
WHERE d."cuenta_id" = anterior."cuenta_id"
  AND d."proveedor_device_id" = anterior."proveedor_device_id"
  AND d."id" <> anterior."id"
  AND d."creado_en" < anterior."creado_en";
CREATE UNIQUE INDEX "dispositivo_cuenta_id_proveedor_device_id_key" ON "dispositivo"("cuenta_id", "proveedor_device_id");

-- CreateIndex
CREATE UNIQUE INDEX "reserva_tecnica_dispositivo_mac_key" ON "reserva_tecnica_dispositivo"("mac");

-- CreateIndex
CREATE UNIQUE INDEX "reserva_tecnica_dispositivo_cuenta_id_proveedor_device_id_key" ON "reserva_tecnica_dispositivo"("cuenta_id", "proveedor_device_id");

-- CreateIndex
CREATE INDEX "reserva_tecnica_dispositivo_empresa_revendedora_id_estado_idx" ON "reserva_tecnica_dispositivo"("empresa_revendedora_id", "estado");

-- CreateIndex
CREATE INDEX "reserva_tecnica_dispositivo_cuenta_id_estado_idx" ON "reserva_tecnica_dispositivo"("cuenta_id", "estado");

-- CreateIndex
CREATE INDEX "solicitud_vinculacion_dispositivo_empresa_revendedora_id_es_idx" ON "solicitud_vinculacion_dispositivo"("empresa_revendedora_id", "estado");

-- CreateIndex
CREATE INDEX "solicitud_vinculacion_dispositivo_cuenta_id_estado_idx" ON "solicitud_vinculacion_dispositivo"("cuenta_id", "estado");

-- CreateIndex
CREATE INDEX "solicitud_vinculacion_dispositivo_proximo_sondeo_en_idx" ON "solicitud_vinculacion_dispositivo"("proximo_sondeo_en");

-- Sólo una solicitud abierta por Cuenta; se conservan todas las históricas.
CREATE UNIQUE INDEX "solicitud_vinculacion_dispositivo_cuenta_abierta_key"
  ON "solicitud_vinculacion_dispositivo"("cuenta_id")
  WHERE "estado" IN ('pendiente', 'observando', 'ambiguo');

-- CreateIndex
CREATE UNIQUE INDEX "incidencia_dispositivo_proveedor_cuenta_id_proveedor_device_key" ON "incidencia_dispositivo_proveedor"("cuenta_id", "proveedor_device_id");

-- CreateIndex
CREATE INDEX "incidencia_dispositivo_proveedor_empresa_revendedora_id_est_idx" ON "incidencia_dispositivo_proveedor"("empresa_revendedora_id", "estado");

-- CreateIndex
CREATE INDEX "incidencia_dispositivo_proveedor_cuenta_id_estado_idx" ON "incidencia_dispositivo_proveedor"("cuenta_id", "estado");

-- AddForeignKey
ALTER TABLE "reserva_tecnica_dispositivo" ADD CONSTRAINT "reserva_tecnica_dispositivo_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_tecnica_dispositivo" ADD CONSTRAINT "reserva_tecnica_dispositivo_empresa_revendedora_id_fkey" FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_vinculacion_dispositivo" ADD CONSTRAINT "solicitud_vinculacion_dispositivo_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "dispositivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_vinculacion_dispositivo" ADD CONSTRAINT "solicitud_vinculacion_dispositivo_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_vinculacion_dispositivo" ADD CONSTRAINT "solicitud_vinculacion_dispositivo_empresa_revendedora_id_fkey" FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencia_dispositivo_proveedor" ADD CONSTRAINT "incidencia_dispositivo_proveedor_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencia_dispositivo_proveedor" ADD CONSTRAINT "incidencia_dispositivo_proveedor_empresa_revendedora_id_fkey" FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security
ALTER TABLE "reserva_tecnica_dispositivo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "solicitud_vinculacion_dispositivo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incidencia_dispositivo_proveedor" ENABLE ROW LEVEL SECURITY;

CREATE POLICY reserva_tecnica_dispositivo_tenant ON "reserva_tecnica_dispositivo"
  USING (
    "empresa_revendedora_id" = app_current_tenant()
    OR (
      app_is_operator()
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "reserva_tecnica_dispositivo"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
  )
  WITH CHECK (
    "empresa_revendedora_id" = app_current_tenant()
    OR (
      app_is_operator()
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "reserva_tecnica_dispositivo"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
  );

CREATE POLICY solicitud_vinculacion_dispositivo_tenant ON "solicitud_vinculacion_dispositivo"
  USING (
    "empresa_revendedora_id" = app_current_tenant()
    OR (
      app_is_operator()
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "solicitud_vinculacion_dispositivo"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
  )
  WITH CHECK (
    "empresa_revendedora_id" = app_current_tenant()
    OR (
      app_is_operator()
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "solicitud_vinculacion_dispositivo"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
  );

CREATE POLICY incidencia_dispositivo_proveedor_tenant ON "incidencia_dispositivo_proveedor"
  USING (
    "empresa_revendedora_id" = app_current_tenant()
    OR (
      app_is_operator()
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "incidencia_dispositivo_proveedor"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
  )
  WITH CHECK (
    "empresa_revendedora_id" = app_current_tenant()
    OR (
      app_is_operator()
      AND EXISTS (
        SELECT 1 FROM "empresa_revendedora" er
        WHERE er."id" = "incidencia_dispositivo_proveedor"."empresa_revendedora_id"
          AND er."operador_principal_id" = app_current_operador()
      )
    )
  );

-- Permisos del usuario de aplicación. El rol puede no existir fuera de Docker.
DO $$
DECLARE
  app_user text := COALESCE(NULLIF(current_setting('app.app_db_user', TRUE), ''), 'iptvcontrol_app');
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_user) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_user);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', app_user);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', app_user);
  END IF;
END
$$;
