-- Corrección: la migración ...03120000 creó `cuenta.procedencia` como TEXT con un
-- CHECK, pero Prisma la modela como ENUM. Prisma genera consultas contra el tipo
-- `"CuentaProcedencia"`, que no existía en Postgres → error 42704 en toda query de Cuenta.
-- Acá se crea el tipo real y se convierte la columna.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CuentaProcedencia') THEN
    CREATE TYPE "CuentaProcedencia" AS ENUM ('creada_en_sistema', 'importada_proveedor');
  END IF;
END $$;

ALTER TABLE "cuenta" ALTER COLUMN "procedencia" DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cuenta_procedencia_check') THEN
    ALTER TABLE "cuenta" DROP CONSTRAINT "cuenta_procedencia_check";
  END IF;
END $$;

ALTER TABLE "cuenta"
  ALTER COLUMN "procedencia" TYPE "CuentaProcedencia"
  USING "procedencia"::text::"CuentaProcedencia";

ALTER TABLE "cuenta"
  ALTER COLUMN "procedencia" SET DEFAULT 'creada_en_sistema';
