import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificacionesService } from './notificaciones.service';
import { ActualizarSonidoNotificacionesDto } from './dto/preferencias.dto';

/**
 * Preferencias individuales del usuario (HU-N05). No dependen del rol: cualquier
 * Team Member autenticado puede leer/guardar la suya.
 */
@ApiTags('notifications')
@Controller('me/notification-sound')
export class PreferenciasController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Get()
  @ApiOperation({ summary: 'Preferencia de sonido de notificaciones del usuario actual.' })
  obtener() {
    return this.notificaciones.obtenerPreferenciaSonido();
  }

  @Patch()
  @ApiOperation({ summary: 'Actualiza la preferencia de sonido del usuario actual.' })
  actualizar(@Body() dto: ActualizarSonidoNotificacionesDto) {
    return this.notificaciones.actualizarPreferenciaSonido(dto.sonido_habilitado);
  }
}
