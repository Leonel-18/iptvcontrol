import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * Edición de propiedades de una Cuenta ya creada: tipo (exclusiva/compartida)
 * y/o su parametrización de servicios.
 */
export class ActualizarCuentaDto {
  @ApiPropertyOptional({
    description:
      'true = exclusiva, false = compartida. Sólo se puede cambiar si la Cuenta tiene a lo sumo ' +
      'un Cliente Final activo y, al pasar a compartida, no supera 2 Dispositivos por categoría.',
  })
  @IsOptional()
  @IsBoolean()
  es_exclusiva?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Códigos de servicio nuevos para la Cuenta (el básico se agrega siempre).',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  servicios?: string[];
}
