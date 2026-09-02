-- SENSA no devuelve la contraseña de Cuentas preexistentes. Una Cuenta
-- importada la completa después desde el flujo manual de cambio de contraseña.
ALTER TABLE "cuenta" ALTER COLUMN "password_cifrado" DROP NOT NULL;
