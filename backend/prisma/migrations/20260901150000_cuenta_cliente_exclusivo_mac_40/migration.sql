-- Una Cuenta exclusiva conserva su titular aunque todavía no tenga Dispositivos.
ALTER TABLE "cuenta"
ADD COLUMN "cliente_final_exclusivo_id" UUID;

-- Primero se recupera el titular desde los Dispositivos que aún ocupan lugar.
WITH candidatos AS (
  SELECT
    c."id" AS cuenta_id,
    (array_agg(DISTINCT d."cliente_final_id"))[1] AS cliente_final_id,
    count(DISTINCT d."cliente_final_id") AS cantidad_clientes
  FROM "cuenta" c
  JOIN "dispositivo" d ON d."cuenta_id" = c."id"
  WHERE c."es_exclusiva" = true
    AND d."cliente_final_id" IS NOT NULL
    AND d."estado" IN ('activo', 'bloqueado_por_suspension')
  GROUP BY c."id"
)
UPDATE "cuenta" c
SET "cliente_final_exclusivo_id" = candidatos.cliente_final_id
FROM candidatos
WHERE c."id" = candidatos.cuenta_id
  AND candidatos.cantidad_clientes = 1;

-- Las importaciones históricas de Micom guardaron el mismo DNI en ambas filas.
WITH candidatos AS (
  SELECT
    c."id" AS cuenta_id,
    (array_agg(cf."id"))[1] AS cliente_final_id,
    count(cf."id") AS cantidad_clientes
  FROM "cuenta" c
  JOIN "cliente_final" cf
    ON cf."empresa_revendedora_id" = c."empresa_revendedora_id"
   AND cf."dni" = c."dni_alta_sensa"
  WHERE c."es_exclusiva" = true
    AND c."cliente_final_exclusivo_id" IS NULL
  GROUP BY c."id"
)
UPDATE "cuenta" c
SET "cliente_final_exclusivo_id" = candidatos.cliente_final_id
FROM candidatos
WHERE c."id" = candidatos.cuenta_id
  AND candidatos.cantidad_clientes = 1;

ALTER TABLE "cuenta"
ADD CONSTRAINT "cuenta_cliente_final_exclusivo_id_fkey"
FOREIGN KEY ("cliente_final_exclusivo_id") REFERENCES "cliente_final"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "cuenta_cliente_final_exclusivo_id_idx"
ON "cuenta"("cliente_final_exclusivo_id");

-- SENSA puede devolver un identificador de dispositivo de hasta 40 caracteres
-- en el campo históricamente llamado MAC.
ALTER TABLE "dispositivo"
ALTER COLUMN "mac" TYPE VARCHAR(40);

ALTER TABLE "incidencia_dispositivo_proveedor"
ALTER COLUMN "mac" TYPE VARCHAR(40);
