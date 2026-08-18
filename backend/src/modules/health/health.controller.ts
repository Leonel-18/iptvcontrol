import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Public } from '../../common/auth/decorators';

/**
 * Health check.
 *
 * Es el único endpoint público: lo consulta el healthcheck de Docker Compose y
 * cualquier monitoreo externo. No expone datos de negocio, sólo si el proceso y
 * la base responden.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Estado del backend y de la base de datos.' })
  async estado() {
    let baseDeDatos = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      baseDeDatos = 'error';
    }

    return {
      status: baseDeDatos === 'ok' ? 'ok' : 'degraded',
      servicio: 'iptvcontrol-backend',
      base_de_datos: baseDeDatos,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Public()
  @ApiExcludeEndpoint()
  async listo() {
    return { ready: true };
  }
}
