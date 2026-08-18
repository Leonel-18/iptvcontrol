import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModalidadComercialTipo } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/**
 * Modalidad Comercial (docs/03_Reglas_de_Negocio.md, sección 1).
 *
 * Dos esquemas posibles:
 *  - `menudeo`: se factura sólo por Cuentas efectivamente utilizadas, con precio
 *    por escala de volumen.
 *  - `obligacion_mensual`: compromiso mínimo mensual creciente y acumulativo
 *    (ej. X5: mes 1 = 5 Cuentas facturadas, mes 2 = 10, mes 3 = 15...). El ritmo
 *    de incremento lo parametriza el Operador Principal, no está hardcodeado.
 */
export class CrearModalidadDto {
  @ApiProperty({ enum: ModalidadComercialTipo })
  @IsEnum(ModalidadComercialTipo)
  tipo!: ModalidadComercialTipo;

  @ApiProperty({
    description: 'Escala: "X5"/"X10" para obligación mensual, o rango de volumen para menudeo.',
    example: 'X5',
  })
  @IsString()
  @MaxLength(40)
  escala!: string;

  @ApiProperty({ description: 'Precio por Cuenta.', example: 4500.0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precio_por_cuenta!: number;

  @ApiPropertyOptional({
    description: 'Para obligación mensual: cuánto crece el compromiso cada mes (ej. 5).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  ritmo_incremento?: number;

  @ApiPropertyOptional({
    description: 'Tope de Cuentas activas habilitadas. Vacío = sin tope explícito.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tope_cuentas_activas?: number;

  @ApiPropertyOptional({
    description: 'Vigencia desde (permite actualizaciones por IPC). Por defecto, hoy.',
  })
  @IsOptional()
  @IsDateString()
  vigente_desde?: string;

  @ApiPropertyOptional({ description: 'Vigencia hasta. Vacío = vigente.' })
  @IsOptional()
  @IsDateString()
  vigente_hasta?: string;
}

export class ActualizarModalidadDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) escala?: string;

  @ApiPropertyOptional({ description: 'Precio por Cuenta. El cambio queda auditado.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precio_por_cuenta?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ritmo_incremento?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tope_cuentas_activas?: number;

  @ApiPropertyOptional() @IsOptional() @IsDateString() vigente_desde?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() vigente_hasta?: string;
}

export class ListarModalidadesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ModalidadComercialTipo })
  @IsOptional()
  @IsEnum(ModalidadComercialTipo)
  type?: ModalidadComercialTipo;

  @ApiPropertyOptional({ description: 'Sólo las vigentes a la fecha de hoy.' })
  @IsOptional()
  @IsString()
  only_current?: string;
}
