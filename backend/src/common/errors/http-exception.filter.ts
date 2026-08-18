import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { RequestContextService } from '../context/request-context.service';

/**
 * Filtro global de errores.
 *
 * Objetivos:
 *  - Respuestas de error con forma estable para el frontend.
 *  - Nunca filtrar detalles internos (stack traces, SQL, credenciales).
 *  - Traducir los errores conocidos de Prisma a mensajes entendibles en español.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private readonly contexto: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Ocurrió un error inesperado.';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
        error = exception.name;
      } else {
        const objeto = payload as Record<string, unknown>;
        message = (objeto.message as string | string[]) ?? exception.message;
        error = (objeto.error as string) ?? exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const traducido = this.traducirPrisma(exception);
      status = traducido.status;
      message = traducido.message;
      error = traducido.error;
    } else if (exception instanceof Error) {
      this.logger.error(`${request.method} ${request.url} — ${exception.message}`, exception.stack);
    }

    if (status >= 500) {
      const detalle = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(
        `[${this.contexto.get()?.requestId ?? '-'}] ${request.method} ${request.url} → ${status}: ${detalle}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: this.contexto.get()?.requestId,
    });
  }

  private traducirPrisma(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Ya existe un registro con esos datos únicos.',
          error: 'RegistroDuplicado',
        };
      case 'P2003':
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'El registro solicitado no existe o no está disponible.',
          error: 'RegistroNoEncontrado',
        };
      default:
        this.logger.error(`Error de Prisma ${exception.code}: ${exception.message}`);
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Ocurrió un error al acceder a los datos.',
          error: 'ErrorDeDatos',
        };
    }
  }
}
