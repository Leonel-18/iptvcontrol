import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * Cambio manual de contraseña de una Cuenta (`PATCH /accounts/:id/password`).
 *
 * La contraseña de una Cuenta nueva se sigue generando automáticamente (8
 * dígitos, ver `CuentasProvisioningService.crearCuenta`); esto es la
 * posibilidad de reemplazarla a mano cuando la Empresa Revendedora lo
 * necesite (ej. no se pudo comunicar la generada, o el Cliente Final ya tenía
 * una acordada de antes). Mismo formato que exige SENSA en el alta: numérica,
 * de 8 a 20 dígitos.
 */
export class CambiarPasswordCuentaDto {
  @ApiProperty({ description: 'Contraseña numérica nueva (8 a 20 dígitos).' })
  @Matches(/^\d{8,20}$/, { message: 'La contraseña debe tener entre 8 y 20 dígitos numéricos.' })
  password!: string;
}
