import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Aislamiento de una Cuenta compartida existente (HU-A02).
 *
 * Sólo se expresa en días: un entero mayor a 0. No se admiten horas ni minutos.
 */
export class AislarCuentaDto {
  @ApiProperty({ description: 'Cantidad de días de aislamiento (entero mayor a 0).', example: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  dias!: number;
}
