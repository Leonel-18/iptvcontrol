import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Paginación y formato de salida comunes a todos los listados.
 *
 * `format=csv` no es una ruta nueva sino un comportamiento sobre el mismo
 * endpoint (docs/IPTVControl_URL_Routing_Convention.md, sección 5.2): el backend
 * cambia el Content-Type y reutiliza exactamente los mismos filtros.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Página a consultar (base 1).', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Cantidad de resultados por página.', default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  per_page?: number = 25;

  @ApiPropertyOptional({ description: 'Búsqueda libre.' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Formato de la respuesta. `csv` descarga el listado completo.',
    enum: ['json', 'csv'],
    default: 'json',
  })
  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv' = 'json';

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.per_page ?? 25);
  }

  get take(): number {
    return this.per_page ?? 25;
  }

  get esCsv(): boolean {
    return this.format === 'csv';
  }
}

/** Envoltorio estándar de los listados paginados. */
export class PaginatedResponse<T> {
  data!: T[];
  meta!: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };

  static build<T>(data: T[], total: number, page: number, perPage: number): PaginatedResponse<T> {
    return {
      data,
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }
}
