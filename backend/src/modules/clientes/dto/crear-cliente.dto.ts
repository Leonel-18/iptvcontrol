import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoAltaClienteFinal, TipoDispositivo } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsHexadecimal,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Dispositivo con el que arranca el Cliente Final. */
export class DispositivoAltaDto {
  @ApiProperty({
    enum: TipoDispositivo,
    description: 'Categoría del dispositivo. Cada una tiene tope independiente de 3 por Cuenta.',
  })
  @IsEnum(TipoDispositivo)
  tipo!: TipoDispositivo;

  @ApiPropertyOptional({
    description:
      'MAC del equipo (12 dígitos hexadecimales). Si se informa, el dispositivo se da de alta ' +
      'explícitamente en el proveedor; si no, se auto-provisiona al iniciar sesión y el ID se ' +
      'captura después por consulta al proveedor.',
    example: '03AC1AE60CA7',
  })
  @IsOptional()
  @IsHexadecimal()
  @Length(12, 12, { message: 'La MAC debe tener 12 dígitos hexadecimales, sin separadores.' })
  mac?: string;

  @ApiPropertyOptional({
    description:
      'Nota interna de la Empresa Revendedora, ej. "TV living". No se envía al proveedor.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nota_descriptiva?: string;
}

/**
 * Alta de Cliente Final.
 *
 * En el frontend esto es un wizard paso a paso (no un formulario único), por los
 * dos métodos de alta y la validación de `id_gestion_externo`
 * (docs/04_Esqueleto_Tecnico_Inicial.md, sección 5). El backend igual recibe una
 * sola llamada con el resultado del asistente.
 */
export class CrearClienteDto {
  @ApiProperty({ description: 'Nombre del Cliente Final.' })
  @IsString()
  @Length(2, 120)
  nombre!: string;

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

  @ApiPropertyOptional({
    description:
      'ID del cliente en el sistema de gestión propio de la Empresa Revendedora. Opcional. ' +
      'Si ya existe otro cliente con el mismo valor, el sistema avisa antes de confirmar.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id_gestion_externo?: string;

  @ApiProperty({
    enum: TipoAltaClienteFinal,
    description:
      '`cuenta_exclusiva`: se crea siempre una Cuenta nueva para este cliente. ' +
      '`dispositivo_compartido`: se busca lugar en una Cuenta existente y, si no hay, se crea una.',
  })
  @IsEnum(TipoAltaClienteFinal)
  tipo_alta!: TipoAltaClienteFinal;

  @ApiProperty({ type: DispositivoAltaDto })
  @ValidateNested()
  @Type(() => DispositivoAltaDto)
  dispositivo!: DispositivoAltaDto;

  @ApiPropertyOptional({
    description:
      'Respuesta a la advertencia de `id_gestion_externo` duplicado: continuar el alta como un ' +
      'Cliente Final nuevo e independiente aunque comparta el ID.',
  })
  @IsOptional()
  @IsBoolean()
  confirmar_duplicado?: boolean;

  @ApiPropertyOptional({
    description:
      'Respuesta a la advertencia de duplicado: agrupar el dispositivo en un Cliente Final que ya ' +
      'existe (deriva al flujo de alta de dispositivo adicional).',
  })
  @IsOptional()
  @IsUUID()
  agrupar_en_cliente_id?: string;
}
