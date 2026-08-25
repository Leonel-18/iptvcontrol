-- DropForeignKey
ALTER TABLE "reserva_tecnica_dispositivo" DROP CONSTRAINT "reserva_tecnica_dispositivo_cuenta_id_fkey";

-- DropForeignKey
ALTER TABLE "reserva_tecnica_dispositivo" DROP CONSTRAINT "reserva_tecnica_dispositivo_empresa_revendedora_id_fkey";

-- DropTable
DROP TABLE "reserva_tecnica_dispositivo";

-- DropEnum
DROP TYPE "EstadoReservaTecnica";
