import { Body, Controller, Post, UseFilters, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/decorators';
import { BotApiKeyGuard } from './bot-api-key.guard';
import { BotErrorFilter } from './bot-error.filter';
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
@UseFilters(BotErrorFilter)
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
      'La ubicación es automática: la venta se suma a la Cuenta compatible más antigua sin Ventana ' +
      'vigente con 1+1 o 2+2 reservado y la protege 96 h por defecto; si no hay ninguna, crea una ' +
      'nueva. Devuelve las credenciales y el mensaje de WhatsApp ya renderizado con la plantilla ' +
      'de la empresa.\n\n' +
      'Errores: la respuesta sigue siendo HTTP 200 pero con `success: false`, `whatsapp.mensaje` ' +
      'con un texto entendible para el Cliente Final y `error.code` para diagnóstico. Así el bot ' +
      'siempre puede mostrar el motivo sin depender de la salida "Error".',
  })
  crear(@Body() dto: CrearClienteBotDto) {
    return this.bot.crearCliente(dto);
  }
}
