import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { RequestContextService } from '../../common/context/request-context.service';
import { mapearErrorBot } from './bot-error.mapper';

/**
 * Filtro de errores exclusivo del endpoint del bot de WhatsApp.
 *
 * Diferencia clave con el filtro global: acá un error de negocio responde
 * **HTTP 200** con `success: false`. Es a propósito — ManyChat sólo mapea los
 * "Campos de respuesta" (`whatsapp.mensaje`) cuando el status es 2xx; ante un
 * 4xx/5xx usa la salida "Error" y deja el mensaje vacío.
 *
 * El cliente recibe siempre un mensaje entendible; el detalle técnico queda en
 * los logs (con el `requestId`), nunca en la respuesta.
 */
@Catch()
export class BotErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('WhatsappBotError');

  constructor(private readonly contexto: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = this.contexto.get()?.requestId ?? '-';

    const { code, mensajeUsuario, detalle, nivelLog } = mapearErrorBot(exception);

    const traza = `[${requestId}] ${request.method} ${request.url} → ${code}: ${detalle}`;
    if (nivelLog === 'error') {
      this.logger.error(traza, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(traza);
    }

    response.status(200).json({
      success: false,
      whatsapp: { mensaje: mensajeUsuario },
      cuenta: { usuario: null, password: null, pin: null },
      error: { code, message: mensajeUsuario },
    });
  }
}
