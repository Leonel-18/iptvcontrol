import { Module } from '@nestjs/common';
import { NotificacionesController } from './notificaciones.controller';
import { PreferenciasController } from './preferencias.controller';
import { NotificacionesService } from './notificaciones.service';

@Module({
  controllers: [NotificacionesController, PreferenciasController],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
