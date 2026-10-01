-- Fix conceptual: "aislamiento" queda únicamente a nivel Cuenta
-- (Cuenta.aislada + Cuenta.aislamiento_fin_en). El alta aislada (HU-A01) ya no
-- marca la venta ni abre una Ventana de Alta: era confuso tener dos formas.
--
-- 1) Migrar los aislamientos creados con el modelo viejo (venta aislada con
--    Ventana de Alta todavía vigente) al estado a nivel Cuenta.
UPDATE "cuenta" c
   SET "aislada" = true,
       "aislamiento_fin_en" = w."fin_previsto_en",
       "actualizado_en" = now()
  FROM "ventana_curiosidad" w
  JOIN "venta_compartida" v ON v."id" = w."venta_compartida_id"
 WHERE w."cuenta_id" = c."id"
   AND v."aislada" = true
   AND w."fin_real_en" IS NULL
   AND w."fin_previsto_en" > now();

-- 2) Cerrar esas Ventanas: el aislamiento deja de depender de ellas.
UPDATE "ventana_curiosidad" w
   SET "fin_real_en" = now(),
       "motivo_fin" = 'reemplazo_por_aislamiento'::"MotivoFinVentanaCuriosidad",
       "actualizado_en" = now()
  FROM "venta_compartida" v
 WHERE w."venta_compartida_id" = v."id"
   AND v."aislada" = true
   AND w."fin_real_en" IS NULL
   AND w."fin_previsto_en" > now();

-- 3) El aislamiento ya no vive en la venta.
ALTER TABLE "venta_compartida" DROP COLUMN "aislada";
