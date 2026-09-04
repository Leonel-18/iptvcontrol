-- Pieza 4 (Fase F): en una venta compartida la ventana de detección se abre SIN
-- crear una fila de Dispositivo previa ("fantasma"). La Solicitud queda asociada
-- al Cliente Final de la venta y el Dispositivo se materializa cuando SENSA
-- reporta el equipo al primer inicio de sesión.

-- 1. La Solicitud puede no tener Dispositivo todavía.
ALTER TABLE "solicitud_vinculacion_dispositivo"
    ALTER COLUMN "dispositivo_id" DROP NOT NULL;

-- 2. Identifica a qué Cliente Final pertenece la ventana (para ventas
--    compartidas sin fila de Dispositivo previa).
ALTER TABLE "solicitud_vinculacion_dispositivo"
    ADD COLUMN "cliente_final_id" UUID;

ALTER TABLE "solicitud_vinculacion_dispositivo"
    ADD CONSTRAINT "solicitud_vinculacion_dispositivo_cliente_final_id_fkey"
    FOREIGN KEY ("cliente_final_id") REFERENCES "cliente_final"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "solicitud_vinculacion_dispositivo_cliente_final_id_idx"
    ON "solicitud_vinculacion_dispositivo"("cliente_final_id");
