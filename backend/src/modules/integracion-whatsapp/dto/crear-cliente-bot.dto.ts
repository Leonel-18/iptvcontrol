import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoAltaClienteFinal } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Dispositivo con el que arranca el Cliente Final. No se pide tipo ni MAC. */
export class DispositivoBotDto {
  @ApiPropertyOptional({ description: 'Nota interna. No se envía al Proveedor.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nota_descriptiva?: string;
}

/**
 * Alta de Cliente Final desde el bot de WhatsApp.
 *
 * Es una versión acotada de `CrearClienteDto`: el bot NO puede elegir la Cuenta
 * destino, la duración de la Ventana de Alta ni resolver incidencias. La
 * duración la fija el servidor (96 h por defecto) y la Empresa Revendedora
 * dueña de las Cuentas la fija la configuración del endpoint.
 *
 * Los datos personales (nombre, DNI, teléfono) los aporta el sistema de gestión
 * de la empresa (ISP BRAIN).
 */
export class CrearClienteBotDto {
  @ApiProperty({ description: 'Nombre del Cliente Final.' })
  @IsString()
  @Length(2, 120)
  nombre!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  apellido?: string;

  @ApiProperty({
    description: 'DNI real de la persona. Dato administrativo local: nunca se envía al Proveedor.',
  })
  @IsString()
  @Matches(/^\d{6,10}$/, { message: 'El DNI debe tener entre 6 y 10 dígitos numéricos.' })
  dni!: string;

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

  @ApiPropertyOptional({
    description:
      'ID del cliente en el sistema de gestión de la Empresa Revendedora (ISP BRAIN). Opcional.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id_gestion_externo?: string;

  @ApiProperty({
    enum: TipoAltaClienteFinal,
    description:
      '`cuenta_exclusiva`: Cuenta nueva 3+3 para ese cliente. ' +
      '`dispositivo_compartido`: Cuenta nueva con 1+1 o 2+2 reservado y Ventana de Alta.',
  })
  @IsEnum(TipoAltaClienteFinal)
  tipo_alta!: TipoAltaClienteFinal;

  @ApiPropertyOptional({
    enum: [1, 2],
    description:
      'Cupos por categoría de la venta compartida: 1 = 1 fijo + 1 móvil; 2 = 2+2. ' +
      'Obligatorio para `dispositivo_compartido`; no aplica a una Cuenta exclusiva.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2])
  cupos_por_categoria?: 1 | 2;

  @ApiPropertyOptional({ type: DispositivoBotDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DispositivoBotDto)
  dispositivo?: DispositivoBotDto;

  @ApiPropertyOptional({
    description: 'Continúa el alta aunque exista otro cliente con el mismo `id_gestion_externo`.',
  })
  @IsOptional()
  @IsBoolean()
  confirmar_duplicado?: boolean;
}
