import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

/**
 * Corrección manual de un Dispositivo vinculado al Cliente Final equivocado
 * (ver docs/03_Reglas_de_Negocio.md, sección 2.2: SENSA no identifica de quién
 * es cada inicio de sesión, así que esta corrección siempre la decide la
 * Empresa Revendedora).
 */
export class CorregirVinculacionDto {
  @ApiProperty({
    enum: ['reasignar', 'eliminar'],
    description:
      '`reasignar`: el Dispositivo es en realidad de otro Cliente Final de esta misma Cuenta. ' +
      '`eliminar`: el equipo no pertenece a ningún Cliente Final y se da de baja en el Proveedor.',
  })
  @IsIn(['reasignar', 'eliminar'])
  accion!: 'reasignar' | 'eliminar';

  @ApiPropertyOptional({
    description: 'Obligatorio si `accion` es `reasignar`: Cliente Final real dueño del equipo.',
  })
  @IsOptional()
  @IsUUID()
  cliente_final_id?: string;
}
