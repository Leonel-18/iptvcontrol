import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsString, Length, Matches } from 'class-validator';

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
  @ApiProperty({ description: 'DNI del Cliente Final.' })
  @IsString()
  @Length(1, 20)
  dni!: string;

  @ApiProperty({ description: 'Contraseña numérica nueva (8 a 20 dígitos).' })
  @Matches(/^\d{8,20}$/, { message: 'La contraseña debe tener entre 8 y 20 dígitos numéricos.' })
  password!: string;
}

export class CambiarPinPortalDto {
  @ApiProperty({ description: 'DNI del Cliente Final.' })
  @IsString()
  @Length(1, 20)
  dni!: string;

  @ApiProperty({ description: 'PIN numérico nuevo (6 dígitos).' })
  @Matches(/^\d{6}$/, { message: 'El PIN debe tener exactamente 6 dígitos numéricos.' })
  pin!: string;
}

export class CambiarServiciosPortalDto {
  @ApiProperty({ description: 'DNI del Cliente Final.' })
  @IsString()
  @Length(1, 20)
  dni!: string;

  @ApiProperty({
    type: [String],
    description: 'Códigos de servicio nuevos. Se validan contra lo contratado por el Operador.',
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  servicios!: string[];
}

export class SincronizarDispositivosPortalDto {
  @ApiProperty({ description: 'DNI del Cliente Final.' })
  @IsString()
  @Length(1, 20)
  dni!: string;
}

export class ReclamarDispositivoPortalDto {
  @ApiProperty({ description: 'DNI del Cliente Final.' })
  @IsString()
  @Length(1, 20)
  dni!: string;

  @ApiProperty({ description: 'ID del Dispositivo en el Proveedor (SENSA).' })
  @IsString()
  @Length(1, 60)
  proveedor_device_id!: string;
}

export class BajaDispositivoPortalDto {
  @ApiProperty({ description: 'DNI del Cliente Final.' })
  @IsString()
  @Length(1, 20)
  dni!: string;
}
