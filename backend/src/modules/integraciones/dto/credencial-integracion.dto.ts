import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { SCOPES_INTEGRACION, type ScopeIntegracion } from '../scopes';

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
    enum: SCOPES_INTEGRACION,
    isArray: true,
    default: [...SCOPES_INTEGRACION],
    description: 'APIs habilitadas. Si se omite, la credencial sirve para todas.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...SCOPES_INTEGRACION], { each: true })
  scopes?: ScopeIntegracion[];

  @ApiPropertyOptional({
    description:
      'Team Member que figura como autor en el Audit Log para las acciones de esta credencial. ' +
      'Debe pertenecer a la misma Empresa Revendedora.',
  })
  @IsOptional()
  @IsUUID()
  team_member_id?: string;
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
