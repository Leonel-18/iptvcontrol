import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SoloRevendedor } from '../../common/auth/decorators';
import { ConfiguracionService } from './configuracion.service';
import { ActualizarVentanaCuriosidadDto } from './dto/configuracion.dto';

@ApiTags('settings')
@Controller('settings/curiosity-window')
@SoloRevendedor()
export class ConfiguracionRevendedorController {
  constructor(private readonly configuracion: ConfiguracionService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene la duración predeterminada de la Ventana de curiosidad.' })
  obtener() {
    return this.configuracion.obtenerVentanaCuriosidad();
  }

  @Patch()
  @ApiOperation({ summary: 'Actualiza la duración máxima para ventas compartidas futuras.' })
  actualizar(@Body() dto: ActualizarVentanaCuriosidadDto) {
    return this.configuracion.actualizarVentanaCuriosidad(dto);
  }
}
