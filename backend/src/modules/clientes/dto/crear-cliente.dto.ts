import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoAltaClienteFinal } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ArrayUnique,
  Length,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** Dispositivo con el que arranca el Cliente Final. */
export class DispositivoAltaDto {
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

  @ApiProperty({
    description:
      'DNI real de la persona. Es un dato administrativo de la Empresa Revendedora: nunca se ' +
      'envía al Proveedor y no tiene relación con el identificador sintético que SENSA exige ' +
      'para dar de alta la Cuenta.',
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

  @ApiPropertyOptional({
    type: [String],
    description:
      'Servicios elegidos para una Cuenta compartida. El básico se agrega siempre. En Cuenta ' +
      'completa el backend usa todos los servicios contratados.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  servicios?: string[];

  @ApiPropertyOptional({
    enum: [1, 2],
    description:
      'Cupos por categoría reservados para una venta compartida: 1 autoriza 1 fijo + 1 móvil; ' +
      '2 autoriza 2 fijos + 2 móviles. Es obligatorio para `dispositivo_compartido`.',
  })
  @IsOptional()
  @IsIn([1, 2])
  cupos_por_categoria?: 1 | 2;

  @ApiPropertyOptional({
    description:
      'Duración de la Ventana de curiosidad para esta venta, en minutos. Puede reducir el ' +
      'predeterminado de la Empresa Revendedora hasta 0, pero nunca superarlo.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  duracion_ventana_curiosidad_minutos?: number;

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
