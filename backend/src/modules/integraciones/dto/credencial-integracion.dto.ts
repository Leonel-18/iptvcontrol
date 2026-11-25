import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { PERMISOS_INTEGRACION, type PermisoIntegracion } from '../permisos';

export class CrearCredencialIntegracionDto {
  @ApiProperty({ description: 'Empresa Revendedora dueña de la credencial.' })
  @IsUUID()
  empresa_revendedora_id!: string;

  @ApiProperty({
    description: 'Etiqueta para el panel, por ejemplo "Bot WhatsApp producción".',
  })
  @IsString()
  @Length(2, 80)
  nombre!: string;

  @ApiPropertyOptional({
    enum: PERMISOS_INTEGRACION,
    isArray: true,
    default: [...PERMISOS_INTEGRACION],
    description: 'Operaciones habilitadas. Si se omite, se otorgan todas.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...PERMISOS_INTEGRACION], { each: true })
  permisos?: PermisoIntegracion[];

  @ApiPropertyOptional({
    description:
      'Team Member que figura como autor en el Audit Log para las acciones de esta credencial. ' +
      'Debe pertenecer a la misma Empresa Revendedora.',
  })
  @IsOptional()
  @IsUUID()
  team_member_id?: string;
}

export class ActualizarPermisosIntegracionDto {
  @ApiProperty({
    enum: PERMISOS_INTEGRACION,
    isArray: true,
    description: 'Operaciones habilitadas para la credencial. Al menos una.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn([...PERMISOS_INTEGRACION], { each: true })
  permisos!: PermisoIntegracion[];
}

export class ListarCredencialesQueryDto {
  @ApiPropertyOptional({ description: 'Filtra por Empresa Revendedora.' })
  @IsOptional()
  @IsUUID()
  empresa_revendedora_id?: string;

  @ApiPropertyOptional({
    description: 'Incluye credenciales revocadas. Por defecto sólo se listan las activas.',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  incluir_revocadas?: boolean;
}
