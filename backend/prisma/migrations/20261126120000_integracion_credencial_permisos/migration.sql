-- Corrección para instalaciones que aplicaron una versión anterior de la
-- migración de integración antes de que la columna `scopes` se reemplazara por
-- `permisos`. Es idempotente: si la tabla ya está correcta, no cambia nada.
--
-- Sin esto, Prisma intenta insertar `permisos` en una tabla que solo tiene
-- `scopes` y el alta de la credencial termina en HTTP 500 (P2022).

ALTER TYPE "AccionAuditoria"
  ADD VALUE IF NOT EXISTS 'cambio_permisos_integracion_credencial';

ALTER TABLE IF EXISTS "integracion_credencial"
  ADD COLUMN IF NOT EXISTS "permisos" TEXT[] NOT NULL
  DEFAULT ARRAY[
    'clientes.leer',
    'clientes.crear',
    'cuentas.editar',
    'dispositivos.leer',
    'dispositivos.gestionar'
  ]::TEXT[];

ALTER TABLE IF EXISTS "integracion_credencial"
  DROP COLUMN IF EXISTS "scopes";
