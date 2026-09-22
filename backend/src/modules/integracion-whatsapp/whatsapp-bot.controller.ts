import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/decorators';
import { BotApiKeyGuard } from './bot-api-key.guard';
import { CrearClienteBotDto } from './dto/crear-cliente-bot.dto';
import { WhatsappBotService } from './whatsapp-bot.service';

/**
 * Integración para el bot de WhatsApp.
 *
 * Ruta plana y fuera del flujo de panel: se autentica con `x-api-key`
 * (`BotApiKeyGuard`) y no con un token de Auth0. `@Public()` es lo que permite
 * que los guards globales de JWT y Team Member no exijan un usuario humano;
 * el guard propio es el que después fija el tenant de la Empresa Revendedora.
 */
@ApiTags('integration')
@Controller('integration/whatsapp')
@UseGuards(BotApiKeyGuard)
export class WhatsappBotController {
  constructor(private readonly bot: WhatsappBotService) {}

  @Post('customers')
  @Public()
  @ApiHeader({
    name: 'x-api-key',
    description: 'API key de la integración (WSP_BOT_API_KEY del servidor).',
    required: true,
  })
  @ApiOperation({
    summary: 'Alta de Cliente Final desde el bot de WhatsApp.',
    description:
      'Crea el Cliente Final y su Cuenta en el Proveedor para la Empresa Revendedora configurada ' +
      'en el servidor. Los servicios no se eligen: se aplican todos los del catálogo (los 7). ' +
      'La Ventana de Alta la fija el sistema (96 h por defecto): una venta ' +
      'compartida siempre nace en una Cuenta nueva con 1+1 o 2+2 reservado. Devuelve las ' +
      'credenciales y el mensaje de WhatsApp ya renderizado con la plantilla de la empresa.',
  })
  crear(@Body() dto: CrearClienteBotDto) {
    return this.bot.crearCliente(dto);
  }
}
