import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/** Preferencia individual de sonido de notificaciones (HU-N05). */
export class ActualizarSonidoNotificacionesDto {
  @ApiProperty({ description: 'Reproducir sonido al recibir una notificación interna.' })
  @IsBoolean()
  sonido_habilitado!: boolean;
}
