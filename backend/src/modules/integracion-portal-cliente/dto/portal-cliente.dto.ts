import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const booleanoDeTexto = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

/**
 * DTOs de la integración del Portal de Cliente.
 *
 * El Cliente Final se identifica por su DNI dentro de la Empresa Revendedora
 * configurada. Todos los cuerpos incluyen el DNI porque la integración es
 * server-to-server y cada request revalida la titularidad antes de operar.
 */
export class SesionPortalDto {
  @ApiProperty({ description: 'DNI del Cliente Final.' })
  @IsString()
  @Length(1, 20)
  dni!: string;
}

export class CambiarPasswordPortalDto {
  @ApiProperty({ description: 'Contraseña numérica nueva (8 a 20 dígitos).' })
  @Matches(/^\d{8,20}$/, { message: 'La contraseña debe tener entre 8 y 20 dígitos numéricos.' })
  password!: string;

  @ApiPropertyOptional({
    description:
      'Obligatorio en Cuentas compartidas. Confirma que la contraseña nueva se aplicará a ' +
      'TODOS los Clientes Finales de la Cuenta. En exclusivas no hace falta.',
  })
  @Transform(booleanoDeTexto)
  @IsOptional()
  @IsBoolean()
  confirmar_cambio_compartida?: boolean;
}

export class CambiarPinPortalDto {
  @ApiProperty({ description: 'PIN numérico nuevo (6 dígitos).' })
  @Matches(/^\d{6}$/, { message: 'El PIN debe tener exactamente 6 dígitos numéricos.' })
  pin!: string;

  @ApiPropertyOptional({
    description:
      'Obligatorio en Cuentas compartidas. Confirma que el PIN aplica a TODOS los Clientes Finales.',
  })
  @Transform(booleanoDeTexto)
  @IsOptional()
  @IsBoolean()
  confirmar_cambio_compartida?: boolean;
}

export class CambiarServiciosPortalDto {
  @ApiProperty({
    type: [String],
    description: 'Códigos de servicio nuevos. Se validan contra lo contratado por el Operador.',
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  servicios!: string[];

  @ApiPropertyOptional({
    description:
      'Obligatorio en Cuentas compartidas. Confirma que el contenido aplica a TODOS los Clientes Finales.',
  })
  @Transform(booleanoDeTexto)
  @IsOptional()
  @IsBoolean()
  confirmar_cambio_compartida?: boolean;
}

export class ReclamarDispositivoPortalDto {
  @ApiProperty({ description: 'DNI del Cliente Final que recibe el Dispositivo.' })
  @IsString()
  @Length(1, 20)
  dni!: string;

  @ApiProperty({ description: 'ID del Dispositivo en el Proveedor (SENSA).' })
  @IsString()
  @Length(1, 60)
  proveedor_device_id!: string;
}
