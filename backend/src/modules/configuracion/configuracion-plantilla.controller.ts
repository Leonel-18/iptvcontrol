import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SoloRevendedor } from '../../common/auth/decorators';
import { ConfiguracionService } from './configuracion.service';
import { ActualizarPlantillaWhatsAppDto } from './dto/configuracion.dto';

@ApiTags('settings')
@Controller('settings/whatsapp-template')
@SoloRevendedor()
export class ConfiguracionPlantillaController {
  constructor(private readonly configuracion: ConfiguracionService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene la plantilla de WhatsApp de la Empresa Revendedora.' })
  obtener() {
    return this.configuracion.obtenerPlantillaWhatsApp();
  }

  @Patch()
  @ApiOperation({ summary: 'Guarda la plantilla de WhatsApp con sus tokens.' })
  actualizar(@Body() dto: ActualizarPlantillaWhatsAppDto) {
    return this.configuracion.actualizarPlantillaWhatsApp(dto);
  }
}
