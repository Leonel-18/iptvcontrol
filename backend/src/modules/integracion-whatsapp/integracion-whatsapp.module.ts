import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import { BotApiKeyGuard } from './bot-api-key.guard';
import { WhatsappBotController } from './whatsapp-bot.controller';
import { WhatsappBotService } from './whatsapp-bot.service';

/**
 * Integración de creación de Clientes Finales desde un bot de WhatsApp.
 *
 * Reutiliza `ClientesService` (alta real, con SENSA, contadores y auditoría) y
 * `ConfiguracionService` (plantilla de WhatsApp de la empresa). No duplica
 * lógica de negocio.
 */
@Module({
  imports: [ClientesModule, ConfiguracionModule],
  controllers: [WhatsappBotController],
  providers: [WhatsappBotService, BotApiKeyGuard],
})
export class IntegracionWhatsappModule {}
