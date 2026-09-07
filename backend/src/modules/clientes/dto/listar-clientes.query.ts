import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoClienteFinal, TipoAltaClienteFinal } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListarClientesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por Empresa Revendedora (uso del Operador Principal).',
  })
  @IsOptional()
  @IsUUID()
  reseller_id?: string;

  @ApiPropertyOptional({ enum: EstadoClienteFinal })
  @IsOptional()
  @IsEnum(EstadoClienteFinal)
  status?: EstadoClienteFinal;

  @ApiPropertyOptional({
    enum: TipoAltaClienteFinal,
    description:
      'Filtra clientes por tipo de alta: `cuenta_exclusiva` (Cuenta completa) o ' +
      '`dispositivo_compartido` (venta en Cuenta compartida).',
  })
  @IsOptional()
  @IsEnum(TipoAltaClienteFinal)
  tipo?: TipoAltaClienteFinal;

  @ApiPropertyOptional({ description: 'Filtra por Cuenta.' })
  @IsOptional()
  @IsUUID()
  account_id?: string;

  @ApiPropertyOptional({ description: 'ID exacto en el sistema de gestión externo.' })
  @IsOptional()
  @IsString()
  external_id?: string;
}

export class ActualizarClienteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apellido?: string;

  @ApiPropertyOptional({ description: 'DNI real de la persona. No se envía al Proveedor.' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6,10}$/, { message: 'El DNI debe tener entre 6 y 10 dígitos numéricos.' })
  dni?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ description: 'ID del cliente en el CRM de la Empresa Revendedora.' })
  @IsOptional()
  @IsString()
  id_gestion_externo?: string;
}
