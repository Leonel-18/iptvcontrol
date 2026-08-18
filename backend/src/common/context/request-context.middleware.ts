import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { RequestContextService } from './request-context.service';

/**
 * Abre el contexto asincrónico del request.
 *
 * Va como middleware (no como interceptor) a propósito: al envolver `next()`,
 * todo lo que ocurre después —guards, pipes, controller, servicios— corre dentro
 * del mismo AsyncLocalStorage, que es exactamente lo que necesita PrismaService
 * para saber a qué tenant pertenece cada consulta.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly contexto: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    res.setHeader('x-request-id', requestId);

    this.contexto.run({ esOperador: false, requestId }, () => next());
  }
}
