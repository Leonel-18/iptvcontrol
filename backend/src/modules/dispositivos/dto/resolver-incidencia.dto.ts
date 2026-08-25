import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class ResolverIncidenciaDto {
  @ApiProperty({
    enum: ['vincular', 'eliminar'],
    description:
      '`vincular`: el Dispositivo es en realidad de un Cliente Final de esta Cuenta (requiere ' +
      '`cliente_final_id`). `eliminar`: el equipo no pertenece a nadie y se da de baja en el Proveedor.',
  })
  @IsIn(['vincular', 'eliminar'])
  accion!: 'vincular' | 'eliminar';

  @ApiPropertyOptional({
    description: 'Obligatorio si `accion` es `vincular`: Cliente Final dueño real del equipo.',
  })
  @IsOptional()
  @IsUUID()
  cliente_final_id?: string;
}
