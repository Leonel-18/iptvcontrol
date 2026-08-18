import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditoriaService } from './auditoria.service';
import { ListarAuditoriaQueryDto } from './dto/listar-auditoria.query';
import { generarCsv, responderCsv } from '../../common/csv/csv.util';

/** Registro de auditoría — `/audit-log` en el frontend. */
@ApiTags('audit-log')
@Controller('audit-log')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @ApiOperation({
    summary: 'Consulta el registro de auditoría.',
    description:
      'El Operador Principal ve el historial completo (con la misma restricción de campos que ' +
      '`/customers` y `/devices`); cada Empresa Revendedora ve sólo el propio.',
  })
  async listar(@Query() query: ListarAuditoriaQueryDto, @Res({ passthrough: true }) res: Response) {
    const resultado = await this.auditoria.listar(query);

    if (query.esCsv) {
      const csv = generarCsv(resultado.data, [
        {
          encabezado: 'Fecha',
          valor: (fila) => new Date(fila.creado_en).toLocaleString('es-AR'),
        },
        { encabezado: 'Acción', valor: (fila) => fila.accion_etiqueta },
        { encabezado: 'Entidad', valor: (fila) => fila.entidad },
        { encabezado: 'ID entidad', valor: (fila) => fila.entidad_id },
        { encabezado: 'Ejecutado por', valor: (fila) => fila.ejecutado_por?.email ?? 'Sistema' },
        { encabezado: 'Rol', valor: (fila) => fila.ejecutado_por?.rol ?? '' },
        {
          encabezado: 'Empresa Revendedora',
          valor: (fila) => fila.empresa_revendedora?.razon_social ?? '',
        },
        { encabezado: 'Detalle', valor: (fila) => JSON.stringify(fila.detalle ?? {}) },
      ]);
      responderCsv(res, 'auditoria', csv);
      return undefined;
    }

    return resultado;
  }

  @Get('actions')
  @ApiOperation({ summary: 'Catálogo de acciones auditadas, con etiquetas en español.' })
  acciones() {
    return { acciones: this.auditoria.acciones(), entidades: this.auditoria.entidades() };
  }
}
