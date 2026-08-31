import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoDispositivo, TipoDispositivo } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/**
 * Filtros del listado de Dispositivos. La jerarquía Cuenta → Dispositivo se
 * resuelve por query param (`?account_id=`), no anidando rutas
 * (docs/IPTVControl_URL_Routing_Convention.md, secciones 1.2 y 3).
 */
export class ListarDispositivosQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Dispositivos de una Cuenta puntual.' })
  @IsOptional()
  @IsUUID()
  account_id?: string;

  @ApiPropertyOptional({ description: 'Dispositivos de un Cliente Final puntual.' })
  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @ApiPropertyOptional({ description: 'Empresa Revendedora (uso del Operador Principal).' })
  @IsOptional()
  @IsUUID()
  reseller_id?: string;

  @ApiPropertyOptional({ enum: TipoDispositivo })
  @IsOptional()
  @IsEnum(TipoDispositivo)
  type?: TipoDispositivo;

  @ApiPropertyOptional({ enum: EstadoDispositivo })
  @IsOptional()
  @IsEnum(EstadoDispositivo)
  status?: EstadoDispositivo;
}

/** Alta de un Dispositivo adicional para un Cliente Final ya existente. */
export class CrearDispositivoDto {
  @ApiProperty({ description: 'Cliente Final al que se le agrega el dispositivo.' })
  @IsUUID()
  customer_id!: string;

  @ApiPropertyOptional({ description: 'Nota interna, ej. "TV dormitorio".' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nota_descriptiva?: string;

  @ApiPropertyOptional({
    description:
      'Duración en minutos si el alta adicional requiere una venta compartida nueva. ' +
      'Si se omite, se usa el predeterminado de la Empresa Revendedora.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  duracion_ventana_curiosidad_minutos?: number;
}

/** Reasignación de un Dispositivo liberado a un Cliente Final. */
export class ReasignarDispositivoDto {
  @ApiProperty({ description: 'Cliente Final que recibe el dispositivo liberado.' })
  @IsUUID()
  customer_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nota_descriptiva?: string;
}

export class ActualizarDispositivoDto {
  @ApiPropertyOptional({ description: 'Nota interna de la Empresa Revendedora.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nota_descriptiva?: string;
}
