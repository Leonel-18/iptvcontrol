-- Agrega el DNI real de la persona al Cliente Final.
-- No tiene relación con "cuenta.dni_alta_sensa" (identificador sintético que
-- exige SENSA para el alta de la Cuenta): este campo es sólo un dato
-- administrativo local de la Empresa Revendedora y nunca se envía al Proveedor.
-- La tabla no tiene filas de producción todavía, por eso se agrega NOT NULL
-- directo, sin backfill.
ALTER TABLE "cliente_final" ADD COLUMN "dni" VARCHAR(20) NOT NULL;
