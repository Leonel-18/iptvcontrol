import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { SoloOperador } from '../../common/auth/decorators';
import { ColaProveedorService } from '../../queues/cola-proveedor.service';

/** Dashboard — `/dashboard` en el frontend. */
@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly cola: ColaProveedorService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'KPIs del panel.',
    description:
      'El Operador Principal ve Cuentas vendidas/disponibles/bloqueadas y la salud de la ' +
      'integración; la Empresa Revendedora ve sus propios números y las alertas de capacidad.',
  })
  async resumen() {
    return this.dashboard.resumen();
  }

  @Get('integration-health')
  @SoloOperador()
  @ApiOperation({
    summary: 'Panel de salud de la integración con el proveedor.',
    description: 'Llamadas exitosas y fallidas recientes, más la cola de reintentos pendientes.',
  })
  async salud() {
    return this.dashboard.saludIntegracion();
  }

  @Post('integration-health/retry-failed')
  @SoloOperador()
  @ApiOperation({
    summary: 'Reintenta los trabajos fallidos de la cola.',
    description:
      'Útil después de resolver una caída del proveedor, sin esperar el próximo intento.',
  })
  async reintentar() {
    const reintentados = await this.cola.reintentarFallidos();
    return { reintentados };
  }
}
