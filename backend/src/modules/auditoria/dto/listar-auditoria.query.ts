import { ApiPropertyOptional } from '@nestjs/swagger';
import { AccionAuditoria, EntidadAuditada } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/**
 * Filtros del Audit Log, con los mismos query params del resto de los listados:
 *   /audit-log?entity=ClienteFinal&entity_id=789
 *   /audit-log?action=cambio_precio
 */
export class ListarAuditoriaQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AccionAuditoria })
  @IsOptional()
  @IsEnum(AccionAuditoria)
  action?: AccionAuditoria;

  @ApiPropertyOptional({ enum: EntidadAuditada })
  @IsOptional()
  @IsEnum(EntidadAuditada)
  entity?: EntidadAuditada;

  @ApiPropertyOptional({ description: 'ID del registro afectado.' })
  @IsOptional()
  @IsString()
  entity_id?: string;

  @ApiPropertyOptional({ description: 'Empresa Revendedora (uso del Operador Principal).' })
  @IsOptional()
  @IsUUID()
  reseller_id?: string;

  @ApiPropertyOptional({ description: 'Desde (ISO 8601).' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta (ISO 8601).' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
