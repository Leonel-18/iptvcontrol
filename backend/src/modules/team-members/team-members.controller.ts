import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamMembersService } from './team-members.service';
import { CrearTeamMemberDto, ListarTeamMembersQueryDto } from './dto/team-member.dto';

/**
 * Team Members — `/team-members` en el frontend.
 *
 * Se renombró desde `/users` para eliminar la ambigüedad con el Cliente Final,
 * que no tiene acceso propio al sistema (convención de rutas, sección 4.3).
 */
@ApiTags('team-members')
@Controller('team-members')
export class TeamMembersController {
  constructor(private readonly teamMembers: TeamMembersService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista Team Members del propio tenant.',
    description: 'El scope lo impone el token: nadie ve los Team Members de otro tenant.',
  })
  async listar(@Query() query: ListarTeamMembersQueryDto) {
    return this.teamMembers.listar(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Datos del Team Member autenticado.' })
  async yo() {
    return this.teamMembers.yo();
  }

  @Post()
  @ApiOperation({
    summary: 'Invita un Team Member.',
    description:
      'Crea el usuario en Auth0 y genera un link de un solo uso para que elija su contraseña ' +
      '(flujo 4.7). El primer operator_admin no se crea acá: se provisiona con `npm run seed:root`.',
  })
  async crear(@Body() dto: CrearTeamMemberDto) {
    return this.teamMembers.crear(dto);
  }

  @Post(':id/resend-invitation')
  @ApiOperation({
    summary: 'Reenvía la invitación.',
    description:
      'Genera un ticket nuevo para el mismo usuario si el link venció o se perdió el mail.',
  })
  async reenviar(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamMembers.reenviarInvitacion(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Da de baja el acceso de un Team Member.',
    description: 'Lo desactiva en IPTVControl y bloquea su login en Auth0.',
  })
  async desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamMembers.desactivar(id);
  }

  @Post(':id/reactivate')
  @ApiOperation({
    summary: 'Reactiva un acceso dado de baja.',
    description:
      'Lo habilita de nuevo en IPTVControl y Auth0. Si la persona todavía no había aceptado la ' +
      'invitación, devuelve además un link de un solo uso nuevo.',
  })
  async reactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamMembers.reactivar(id);
  }

  @Delete(':id/definitivo')
  @ApiOperation({
    summary: 'Elimina definitivamente un Team Member invitado o inactivo.',
    description:
      'Borra el usuario en Auth0 y la fila local, para poder volver a invitar el mismo email. ' +
      'Sobre un acceso activo primero hay que darlo de baja.',
  })
  async eliminarDefinitivamente(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamMembers.eliminarDefinitivamente(id);
  }
}
