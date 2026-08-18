import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoCuenta } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/**
 * Filtros del listado de Cuentas.
 *
 * Van como query params y no como segmentos de ruta, siguiendo la convención de
 * docs/IPTVControl_URL_Routing_Convention.md (sección 1.4):
 *   /accounts?reseller_id=123&status=activa
 */
export class ListarCuentasQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Empresa Revendedora. Sólo lo usa el Operador Principal; ' +
      'para una Empresa Revendedora el scope ya lo impone su token.',
  })
  @IsOptional()
  @IsUUID()
  reseller_id?: string;

  @ApiPropertyOptional({ enum: EstadoCuenta })
  @IsOptional()
  @IsEnum(EstadoCuenta)
  status?: EstadoCuenta;

  @ApiPropertyOptional({ description: 'Filtra por Cuentas exclusivas o compartidas.' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
  @IsBoolean()
  exclusive?: boolean;
}
