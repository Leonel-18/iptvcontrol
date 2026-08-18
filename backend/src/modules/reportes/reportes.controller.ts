import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportesService } from './reportes.service';
import { SoloOperador } from '../../common/auth/decorators';
import { generarCsv, responderCsv } from '../../common/csv/csv.util';

/** Reportes — `/reports` en el frontend. */
@ApiTags('reports')
@Controller('reports')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('consumption')
  @SoloOperador()
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  @ApiOperation({
    summary: 'Reporte de consumo: licencias comprometidas vs. usadas.',
    description:
      'Base para la facturación manual del Operador Principal a cada Empresa Revendedora. ' +
      'Con `format=csv` se descarga la tabla.',
  })
  async consumo(
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const reporte = await this.reportes.consumo();

    if (format === 'csv') {
      const csv = generarCsv(reporte.filas, [
        { encabezado: 'Empresa Revendedora', valor: (fila) => fila.razon_social },
        { encabezado: 'CUIT', valor: (fila) => fila.cuit },
        { encabezado: 'Estado', valor: (fila) => fila.estado },
        { encabezado: 'Modalidad', valor: (fila) => fila.modalidad },
        { encabezado: 'Escala', valor: (fila) => fila.escala },
        { encabezado: 'Precio por cuenta', valor: (fila) => fila.precio_por_cuenta },
        { encabezado: 'Cuentas activas', valor: (fila) => fila.cuentas_activas },
        { encabezado: 'Cuentas en uso', valor: (fila) => fila.cuentas_en_uso },
        { encabezado: 'Cuentas comprometidas', valor: (fila) => fila.cuentas_comprometidas },
        { encabezado: 'Cuentas facturables', valor: (fila) => fila.cuentas_facturables },
        { encabezado: 'Cuentas sin usar', valor: (fila) => fila.cuentas_sin_usar },
        { encabezado: 'Importe estimado', valor: (fila) => fila.importe_estimado },
        { encabezado: 'Dispositivos activos', valor: (fila) => fila.dispositivos_activos },
        { encabezado: 'Clientes activos', valor: (fila) => fila.clientes_activos },
      ]);
      responderCsv(res, 'consumo', csv);
      return undefined;
    }

    return reporte;
  }

  @Get('licenses')
  @SoloOperador()
  @ApiOperation({
    summary: 'Licencias contratadas vs. usadas según el proveedor.',
    description: 'Consulta en vivo. Si el proveedor no responde, el reporte lo informa sin fallar.',
  })
  async licencias() {
    return this.reportes.licencias();
  }
}
