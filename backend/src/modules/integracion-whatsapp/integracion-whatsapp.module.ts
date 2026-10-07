import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import { BotApiKeyGuard } from './bot-api-key.guard';
import { BotErrorFilter } from './bot-error.filter';
import { WhatsappBotController } from './whatsapp-bot.controller';
import { WhatsappBotService } from './whatsapp-bot.service';
import { BOT_REDIS_CLIENT, BotRateLimitService } from './bot-rate-limit.service';
import { BotRedisService } from './bot-redis.service';

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
  providers: [
    WhatsappBotService,
    BotApiKeyGuard,
    BotErrorFilter,
    BotRateLimitService,
    BotRedisService,
    { provide: BOT_REDIS_CLIENT, useExisting: BotRedisService },
  ],
})
export class IntegracionWhatsappModule {}
