import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * Cambio manual del PIN de una Cuenta (`PATCH /accounts/:id/pin`).
 *
 * El PIN de control parental se genera automáticamente en el alta (6 dígitos);
 * este endpoint permite reemplazarlo a mano cuando la Empresa Revendedora lo
 * necesite. Mismo formato que exige SENSA en el alta: numérico, de 6 dígitos.
 */
export class CambiarPinCuentaDto {
  @ApiProperty({ description: 'PIN numérico nuevo (6 dígitos).' })
  @Matches(/^\d{6}$/, { message: 'El PIN debe tener exactamente 6 dígitos numéricos.' })
  pin!: string;
}
