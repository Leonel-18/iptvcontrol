import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoTeamMember, RolTeamMember } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CrearTeamMemberDto {
  @ApiProperty({ description: 'Email que va a usar como login (se crea en Auth0).' })
  @IsEmail({}, { message: 'El email no es válido.' })
  @MaxLength(160)
  email!: string;

  @ApiPropertyOptional({ description: 'Nombre y apellido, para mostrar en el panel.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @ApiProperty({
    enum: RolTeamMember,
    description:
      'En el MVP se usan `operator_admin` y `reseller_admin`. Los `*_staff` están declarados en el ' +
      'glosario pero reservados a una etapa futura.',
  })
  @IsEnum(RolTeamMember)
  rol!: RolTeamMember;

  @ApiPropertyOptional({
    description:
      'Empresa Revendedora a la que pertenece. Obligatorio para roles `reseller_*` cuando el alta ' +
      'la hace el Operador Principal.',
  })
  @IsOptional()
  @IsUUID()
  empresa_revendedora_id?: string;
}

export class ListarTeamMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RolTeamMember })
  @IsOptional()
  @IsEnum(RolTeamMember)
  role?: RolTeamMember;

  @ApiPropertyOptional({ enum: EstadoTeamMember })
  @IsOptional()
  @IsEnum(EstadoTeamMember)
  status?: EstadoTeamMember;

  @ApiPropertyOptional({
    description: 'Filtra por Empresa Revendedora (uso del Operador Principal).',
  })
  @IsOptional()
  @IsUUID()
  reseller_id?: string;
}
