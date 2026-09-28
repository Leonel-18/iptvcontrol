import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Apertura manual de una Ventana de Alta en una Cuenta compartida.
 *
 * Si no se envía la duración, se usa la predeterminada de la Empresa Revendedora.
 * Debe ser mayor a 0: una ventana sin duración no protege la Cuenta.
 */
export class AbrirVentanaCuriosidadDto {
  @ApiPropertyOptional({
    description: 'Duración de la Ventana de Alta, en minutos. Default: la de la empresa.',
    example: 1440,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  duracion_minutos?: number;
}
