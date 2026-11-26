-- Permisos nuevos para clientes en credenciales ya creadas.
-- Idempotente: se puede aplicar sobre una base con o sin credenciales.

ALTER TABLE IF EXISTS "integracion_credencial"
  ALTER COLUMN "permisos" SET DEFAULT ARRAY[
    'clientes.leer',
    'clientes.crear',
    'clientes.editar',
    'clientes.estado',
    'cuentas.editar',
    'dispositivos.leer',
    'dispositivos.gestionar'
  ]::TEXT[];

UPDATE "integracion_credencial"
SET "permisos" = array_append("permisos", 'clientes.editar')
WHERE NOT ('clientes.editar' = ANY("permisos"));

UPDATE "integracion_credencial"
SET "permisos" = array_append("permisos", 'clientes.estado')
WHERE NOT ('clientes.estado' = ANY("permisos"));
