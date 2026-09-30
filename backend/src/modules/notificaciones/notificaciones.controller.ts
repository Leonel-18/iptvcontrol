import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SoloRevendedor } from '../../common/auth/decorators';
import { NotificacionesService } from './notificaciones.service';

@ApiTags('notifications')
@Controller('notifications')
@SoloRevendedor()
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Get()
  @ApiOperation({
    summary: 'Centro de notificaciones del usuario.',
    description:
      'Últimas notificaciones de la Empresa Revendedora, con el estado leído/no leído del usuario ' +
      'actual. La notificación es del tenant; el estado de lectura es individual.',
  })
  listar() {
    return this.notificaciones.listar();
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Cantidad de notificaciones sin leer (para la campana).' })
  contarNoLeidas() {
    return this.notificaciones.contarNoLeidas();
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Marca como leídas todas las notificaciones pendientes del usuario.' })
  marcarTodasLeidas() {
    return this.notificaciones.marcarTodasLeidas();
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Marca una notificación como leída para el usuario actual.' })
  marcarLeida(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificaciones.marcarLeida(id);
  }
}
