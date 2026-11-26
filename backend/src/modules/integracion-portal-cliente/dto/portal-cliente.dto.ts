import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
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

export class BuscarClientePortalQueryDto {
  @ApiPropertyOptional({ description: 'DNI del Cliente Final.' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  dni?: string;

  @ApiPropertyOptional({ description: 'ID del cliente en el CRM de la Empresa.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id_gestion_externo?: string;
}

export class ActualizarClientePortalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  apellido?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'El email del cliente no es válido.' })
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;

  @ApiPropertyOptional({ description: 'ID del cliente en el CRM de la Empresa.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id_gestion_externo?: string;
}

export class BajaDispositivoPortalDto {
  @ApiPropertyOptional({
    description:
      'Obligatorio para confirmar la baja definitiva en el Proveedor. Sin este campo responde 409.',
  })
  @Transform(booleanoDeTexto)
  @IsOptional()
  @IsBoolean()
  confirmar_baja_definitiva?: boolean;
}

export class TerminarClientePortalDto {
  @ApiPropertyOptional({
    description:
      'Obligatorio para confirmar la baja definitiva del Cliente. Sin este campo responde 409.',
  })
  @Transform(booleanoDeTexto)
  @IsOptional()
  @IsBoolean()
  confirmar_baja_definitiva?: boolean;
}
