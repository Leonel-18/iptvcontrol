import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SoloRevendedor } from '../../common/auth/decorators';
import { ConfiguracionService } from './configuracion.service';
import { ActualizarNotificacionesDto } from './dto/configuracion.dto';

@ApiTags('settings')
@Controller('settings/notifications')
@SoloRevendedor()
export class ConfiguracionNotificacionesController {
  constructor(private readonly configuracion: ConfiguracionService) {}

  @Get()
  @ApiOperation({
    summary: 'Preferencias de notificaciones internas de la Empresa Revendedora.',
    description:
      'Avisos de dispositivos pendientes (con su frecuencia) y de ventanas de alta por vencer ' +
      '(con sus días de anticipación). Los hitos de cuentas de prueba son parametrización del ' +
      'Operador Principal y se informan como referencia.',
  })
  obtener() {
    return this.configuracion.obtenerNotificaciones();
  }

  @Patch()
  @ApiOperation({ summary: 'Actualiza las preferencias de notificaciones internas.' })
  actualizar(@Body() dto: ActualizarNotificacionesDto) {
    return this.configuracion.actualizarNotificaciones(dto);
  }
}
