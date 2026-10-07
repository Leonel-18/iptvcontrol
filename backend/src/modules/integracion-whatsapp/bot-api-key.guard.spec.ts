import { ConfigService } from '@nestjs/config';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { BotApiKeyGuard } from './bot-api-key.guard';
import { BotRateLimitExcedidoError, BotRateLimitService } from './bot-rate-limit.service';

describe('BotApiKeyGuard', () => {
  it('responde 429 y Retry-After cuando la API key supera su límite', async () => {
    const config = {
      get: jest.fn((clave: string) => {
        if (clave === 'whatsappBot.apiKey') return 'api-key-valida';
        if (clave === 'whatsappBot.empresaRevendedoraId') return 'empresa-1';
        return undefined;
      }),
    } as unknown as ConfigService;
    const prisma = {} as PrismaService;
    const contexto = { set: jest.fn() } as unknown as RequestContextService;
    const rateLimit = {
      consumir: jest.fn().mockRejectedValue(new BotRateLimitExcedidoError(42)),
    } as unknown as BotRateLimitService;
    const setHeader = jest.fn();
    const executionContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-api-key': 'api-key-valida' } }),
        getResponse: () => ({ setHeader }),
      }),
    } as unknown as ExecutionContext;
    const guard = new BotApiKeyGuard(config, prisma, contexto, rateLimit);

    const error = await guard.canActivate(executionContext).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(HttpException);
    if (!(error instanceof HttpException)) throw error;
    expect(error.getStatus()).toBe(429);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });
});
