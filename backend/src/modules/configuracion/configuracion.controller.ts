import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfiguracionService } from './configuracion.service';
import { ActualizarConexionProveedorDto, ProbarConexionDto } from './dto/configuracion.dto';
import { SoloOperador } from '../../common/auth/decorators';

/**
 * Configuración — `/settings` en el frontend.
 *
 * Rutas de la sección 9.3 de docs/04_Esqueleto_Tecnico_Inicial.md. Se mantienen
 * los nombres propuestos ahí (`/settings/sensa`) porque están documentados como
 * contrato con Federico; el segmento final coincide con el conector activo.
 */
@ApiTags('settings')
@Controller('settings')
@SoloOperador()
export class ConfiguracionController {
  constructor(private readonly configuracion: ConfiguracionService) {}

  @Get('sensa')
  @ApiOperation({
    summary: 'Configuración de conexión con el proveedor.',
    description: 'El token nunca se devuelve en claro: sólo si está cargado y una pista.',
  })
  async obtener() {
    return this.configuracion.obtener();
  }

  @Patch('sensa')
  @ApiOperation({
    summary: 'Actualiza la conexión con el proveedor y los parámetros de integración.',
    description:
      'Incluye `dni_inicial_sensa`, el umbral de alerta de capacidad y el límite de reintentos de ' +
      'identificador. El cambio queda registrado en el Audit Log.',
  })
  async actualizar(@Body() dto: ActualizarConexionProveedorDto) {
    return this.configuracion.actualizar(dto);
  }

  @Post('sensa/test-connection')
  @ApiOperation({
    summary: 'Prueba la conexión con el proveedor.',
    description:
      'Ejecuta el método Test API (`GET /v4/`) desde el servidor. Si se envían credenciales, se ' +
      'prueban ésas sin guardarlas; si no, se prueba la configuración almacenada.',
  })
  async probar(@Body() dto: ProbarConexionDto) {
    return this.configuracion.probarConexion(dto);
  }
}
