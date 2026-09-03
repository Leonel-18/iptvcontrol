-- Campos comerciales por Empresa Revendedora y trazabilidad de ediciones.
-- 1. Límite mensual de creación de Cuentas (parametrizable, default 10).
-- 2. Fecha de asignación de la modalidad vigente (inicio del "mes 1" de X5/X10).
-- 3. Origen de la Cuenta (creada en sistema vs. importada) y conciliación inicial.
-- 4. Acciones de auditoría para edición/suspensión/reactivación de empresas y slots.
-- 5. Habilita varias vinculaciones simultáneas por Cuenta (resolución manual).

ALTER TABLE "empresa_revendedora"
  ADD COLUMN "cuentas_max_crear_mensual" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "modalidad_asignada_en" TIMESTAMP(3);

ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'actualizacion_empresa_revendedora';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'suspension_empresa_revendedora';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'reactivacion_empresa_revendedora';
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'cambio_slots_cuenta';

ALTER TABLE "cuenta"
  ADD COLUMN "procedencia" TEXT NOT NULL DEFAULT 'creada_en_sistema',
  ADD COLUMN "inventario_conciliado_en" TIMESTAMP(3);

ALTER TABLE "cuenta"
  ADD CONSTRAINT "cuenta_procedencia_check" CHECK ("procedencia" IN ('creada_en_sistema', 'importada_proveedor'));

-- Permite ventanas de detección simultáneas por Cuenta (SENSA no identifica qué
-- Cliente inició sesión; la atribución se resuelve manualmente vía incidencias).
DROP INDEX IF EXISTS "solicitud_vinculacion_dispositivo_cuenta_abierta_key";
