-- La duración predeterminada de la Ventana de Alta dejó de ser un tope (regla
-- actualizada el 07/09/2026): el vendedor elige libremente la duración de cada
-- venta y el bot de WhatsApp aplica la suya (96 h por defecto).
--
-- La restricción original exigía que `duracion_aplicada_minutos` no superara la
-- predeterminada, lo que rompía esas ventas con un error 23514 cuando la
-- predeterminada de la Empresa Revendedora era menor (típicamente 0). Se
-- reemplaza por la validación de no-negatividad, que es la única que el backend
-- sigue exigiendo.
ALTER TABLE "ventana_curiosidad" DROP CONSTRAINT "ventana_curiosidad_duraciones_check";
ALTER TABLE "ventana_curiosidad" ADD CONSTRAINT "ventana_curiosidad_duraciones_check"
  CHECK (
    "duracion_predeterminada_minutos" >= 0
    AND "duracion_aplicada_minutos" >= 0
  );
