import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RevendedorasService } from './revendedoras.service';
import {
  ActualizarRevendedoraDto,
  CambiarModalidadDto,
  CrearRevendedoraDto,
  ListarRevendedorasQueryDto,
} from './dto/revendedora.dto';
import { SoloOperador } from '../../common/auth/decorators';
import { generarCsv, responderCsv } from '../../common/csv/csv.util';

/**
 * Empresas Revendedoras — `/resellers` en el frontend.
 * Visible sólo para el Operador Principal, salvo `/resellers/me`.
 */
@ApiTags('resellers')
@Controller('resellers')
export class RevendedorasController {
  constructor(private readonly revendedoras: RevendedorasService) {}

  @Get()
  @SoloOperador()
  @ApiOperation({ summary: 'Lista Empresas Revendedoras.' })
  async listar(
    @Query() query: ListarRevendedorasQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resultado = await this.revendedoras.listar(query);

    if (query.esCsv) {
      const csv = generarCsv(resultado.data, [
        { encabezado: 'Razón social', valor: (fila) => fila.razon_social },
        { encabezado: 'CUIT', valor: (fila) => fila.cuit },
        { encabezado: 'Contacto', valor: (fila) => fila.contacto },
        { encabezado: 'Teléfono', valor: (fila) => fila.telefono_contacto },
        { encabezado: 'Email', valor: (fila) => fila.email_contacto },
        { encabezado: 'Estado', valor: (fila) => fila.estado },
        { encabezado: 'Modalidad', valor: (fila) => fila.modalidad_comercial?.tipo ?? '' },
        { encabezado: 'Escala', valor: (fila) => fila.modalidad_comercial?.escala ?? '' },
        { encabezado: 'Cuentas', valor: (fila) => fila.cantidad_cuentas },
        { encabezado: 'Clientes', valor: (fila) => fila.cantidad_clientes },
      ]);
      responderCsv(res, 'empresas-revendedoras', csv);
      return undefined;
    }

    return resultado;
  }

  @Get('me')
  @ApiOperation({
    summary: 'Perfil de la propia Empresa Revendedora.',
    description:
      'Incluye la modalidad comercial y los precios vigentes que le corresponden (regla 1.3).',
  })
  async miPerfil() {
    return this.revendedoras.miPerfil();
  }

  @Get(':id')
  @SoloOperador()
  @ApiOperation({
    summary: 'Detalle de una Empresa Revendedora.',
    description:
      'Incluye resumen de Cuentas y Dispositivos por ID, sin datos de Clientes Finales ni ' +
      'credenciales (regla 4.2).',
  })
  async obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.revendedoras.obtener(id);
  }

  @Post()
  @SoloOperador()
  @ApiOperation({
    summary: 'Alta de Empresa Revendedora.',
    description: 'Crea el tenant y envía la invitación del reseller_admin (flujo 4.7).',
  })
  async crear(@Body() dto: CrearRevendedoraDto) {
    return this.revendedoras.crear(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualiza datos de la Empresa Revendedora.',
    description:
      'El Operador Principal puede además activarla o suspenderla; la propia Empresa Revendedora ' +
      'sólo puede mantener sus datos de contacto.',
  })
  async actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarRevendedoraDto) {
    return this.revendedoras.actualizar(id, dto);
  }

  @Post(':id/commercial-plan')
  @SoloOperador()
  @ApiOperation({
    summary: 'Cambia la modalidad comercial o la escala.',
    description:
      'Downgrade y upgrade, ambos potestad exclusiva del Operador Principal. Queda registrado en el ' +
      'Audit Log con valores anterior y nuevo.',
  })
  async cambiarModalidad(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CambiarModalidadDto) {
    return this.revendedoras.cambiarModalidad(id, dto);
  }
}
