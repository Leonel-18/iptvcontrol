import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SoloRevendedor } from '../../common/auth/decorators';
import { ResolverIncidenciaDto } from './dto/resolver-incidencia.dto';
import { IncidenciasDispositivosService } from './incidencias-dispositivos.service';

@ApiTags('device-incidents')
@Controller('device-incidents')
@SoloRevendedor()
export class IncidenciasDispositivosController {
  constructor(private readonly incidencias: IncidenciasDispositivosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista vinculaciones ambiguas pendientes de resolución.' })
  listar() {
    return this.incidencias.listarPendientes();
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Vincula el candidato elegido o elimina el Dispositivo desconocido.' })
  resolver(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolverIncidenciaDto) {
    return this.incidencias.resolver(id, dto.accion, dto.cliente_final_id);
  }
}
