import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModalidadesService } from './modalidades.service';
import {
  ActualizarModalidadDto,
  CrearModalidadDto,
  ListarModalidadesQueryDto,
} from './dto/modalidad.dto';
import { SoloOperador } from '../../common/auth/decorators';

/** Modalidades Comerciales — `/commercial-plans` en el frontend. */
@ApiTags('commercial-plans')
@Controller('commercial-plans')
export class ModalidadesController {
  constructor(private readonly modalidades: ModalidadesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista modalidades comerciales.',
    description:
      'El Operador Principal las administra; la Empresa Revendedora las lee para conocer los ' +
      'precios vigentes que le corresponden.',
  })
  async listar(@Query() query: ListarModalidadesQueryDto) {
    return this.modalidades.listar(query);
  }

  @Get('my-pricing')
  @ApiOperation({
    summary: 'Precios vigentes de la Empresa Revendedora autenticada.',
    description:
      'Incluye el compromiso mensual calculado cuando opera con obligación mensual (escala ' +
      'creciente y acumulativa).',
  })
  async misPrecios() {
    return this.modalidades.misPrecios();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una modalidad comercial.' })
  async obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.modalidades.obtener(id);
  }

  @Post()
  @SoloOperador()
  @ApiOperation({ summary: 'Crea una modalidad comercial.' })
  async crear(@Body() dto: CrearModalidadDto) {
    return this.modalidades.crear(dto);
  }

  @Patch(':id')
  @SoloOperador()
  @ApiOperation({
    summary: 'Actualiza escala, precio o parámetros de una modalidad.',
    description:
      'Todo cambio de precio queda registrado en el Audit Log con valor anterior y nuevo.',
  })
  async actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarModalidadDto) {
    return this.modalidades.actualizar(id, dto);
  }
}
