import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProveedoresService } from './proveedores.service';
import { SoloOperador } from '../../common/auth/decorators';

/**
 * Proveedores — `/providers` en el frontend.
 * Hoy un único registro (SENSA); preparado para multi-proveedor post-MVP.
 */
@ApiTags('providers')
@Controller('providers')
export class ProveedoresController {
  constructor(private readonly proveedores: ProveedoresService) {}

  @Get()
  @SoloOperador()
  @ApiOperation({ summary: 'Lista los proveedores de contenido registrados.' })
  async listar() {
    return this.proveedores.listar();
  }

  @Get('services-catalog')
  @ApiOperation({
    summary: 'Catálogo de paquetes de contenido del proveedor.',
    description: 'Códigos del Anexo de Servicios. El paquete básico es obligatorio.',
  })
  async catalogo() {
    return this.proveedores.catalogoServiciosDisponibles();
  }

  @Get('licenses')
  @SoloOperador()
  @ApiOperation({
    summary: 'Licencias contratadas vs. usadas.',
    description: 'Consulta en vivo al proveedor. Alimenta el reporte de consumo.',
  })
  async licencias() {
    return this.proveedores.licencias();
  }

  @Post(':id/activate')
  @SoloOperador()
  @ApiOperation({ summary: 'Define el proveedor activo del Operador Principal.' })
  async activar(@Param('id', ParseUUIDPipe) id: string) {
    return this.proveedores.activar(id);
  }
}
