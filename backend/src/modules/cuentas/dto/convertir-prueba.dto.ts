import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Conversión de una cuenta de prueba a permanente (HU-P05).
 *
 * La Cuenta, el cliente, las credenciales y los Dispositivos se conservan. En
 * una Cuenta compartida se puede pedir opcionalmente una Ventana de Alta; en una
 * exclusiva no aplica.
 */
export class ConvertirPruebaAPermanenteDto {
  @ApiPropertyOptional({
    description:
      'Ventana de Alta opcional para una Cuenta compartida, en minutos (entero mayor a 0). ' +
      'Si no se envía, la Cuenta queda como Compartida normal de inmediato.',
    example: 1440,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  duracion_ventana_curiosidad_minutos?: number;
}
