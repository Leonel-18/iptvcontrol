import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SoloOperador } from '../../common/auth/decorators';
import { CredencialesIntegracionService } from './credenciales-integracion.service';
import {
  CrearCredencialIntegracionDto,
  ListarCredencialesQueryDto,
} from './dto/credencial-integracion.dto';

/**
 * Administración de credenciales de integración.
 *
 * Sólo el Operador Principal: la key se entrega a la Empresa Revendedora, pero
 * no la administra desde su panel.
 */
@ApiTags('integrations')
@Controller('integrations/credentials')
@SoloOperador()
export class IntegracionesController {
  constructor(private readonly credenciales: CredencialesIntegracionService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista credenciales de integración.',
    description:
      'Devuelve una fila por credencial con su prefijo, estado, alcances y último uso. ' +
      'Nunca devuelve la key completa ni su hash.',
  })
  listar(@Query() query: ListarCredencialesQueryDto) {
    return this.credenciales.listar({
      empresaRevendedoraId: query.empresa_revendedora_id,
      incluirRevocadas: query.incluir_revocadas,
    });
  }

  @Post()
  @ApiOperation({
    summary: 'Crea una credencial de integración para una Empresa Revendedora.',
    description:
      'La key completa se devuelve UNA SOLA VEZ en `api_key`; después sólo se muestra su prefijo.',
  })
  crear(@Body() dto: CrearCredencialIntegracionDto) {
    return this.credenciales.crear({
      empresaRevendedoraId: dto.empresa_revendedora_id,
      nombre: dto.nombre,
      scopes: dto.scopes,
      teamMemberId: dto.team_member_id,
    });
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoca una credencial. Es idempotente.' })
  revocar(@Param('id', ParseUUIDPipe) id: string) {
    return this.credenciales.revocar(id);
  }

  @Post(':id/rotate')
  @ApiOperation({
    summary: 'Rota una credencial: crea una nueva y revoca la anterior.',
    description: 'La key nueva se devuelve UNA SOLA VEZ en `api_key`.',
  })
  rotar(@Param('id', ParseUUIDPipe) id: string) {
    return this.credenciales.rotar(id);
  }
}
