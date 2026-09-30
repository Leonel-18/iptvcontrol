-- HU-D01 — Detección de dispositivos sin Cliente Final (Épica D).
-- Guarda cuántos Clientes Finales activos tenía la Cuenta al detectar el
-- dispositivo sin dueño: es lo que decide autoasignar (1) o notificar (0 / 2+).

ALTER TABLE "incidencia_dispositivo_proveedor"
  ADD COLUMN "clientes_activos_al_detectar" INTEGER;
