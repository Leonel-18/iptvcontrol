import { ExecutionContext, HttpException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { BotApiKeyGuard } from './bot-api-key.guard';
import { CredencialesIntegracionService } from '../integraciones/credenciales-integracion.service';
import {
  IntegracionRateLimitExcedidoError,
  IntegracionRateLimitService,
} from '../integraciones/integracion-rate-limit.service';

describe('BotApiKeyGuard', () => {
  const credencialAutenticada = {
    empresaRevendedoraId: 'empresa-1',
    teamMemberId: 'team-1',
    credencialId: 'cred-1',
    origen: 'base' as const,
  };

  const crearGuard = (opciones: {
    key?: string | undefined;
    autenticar?: jest.Mock;
    consumir?: jest.Mock;
    empresa?: Record<string, unknown> | null;
    teamMember?: Record<string, unknown> | null;
  }) => {
    const autenticar = opciones.autenticar ?? jest.fn().mockResolvedValue(credencialAutenticada);
    const consumir = opciones.consumir ?? jest.fn().mockResolvedValue(undefined);
    const credenciales = {
      autenticar,
      marcarUso: jest.fn().mockResolvedValue(undefined),
    } as unknown as CredencialesIntegracionService;
    const rateLimit = { consumir } as unknown as IntegracionRateLimitService;
    const prisma = {
      db: {
        empresaRevendedora: {
          findUnique: jest
            .fn()
            .mockResolvedValue(
              opciones.empresa === undefined
                ? { operadorPrincipalId: 'operador-1', estado: 'activa' }
                : opciones.empresa,
            ),
        },
        teamMember: {
          findUnique: jest
            .fn()
            .mockResolvedValue(
              opciones.teamMember === undefined
                ? { empresaRevendedoraId: 'empresa-1' }
                : opciones.teamMember,
            ),
        },
      },
    } as unknown as PrismaService;
    const contexto = { set: jest.fn() } as unknown as RequestContextService;
    const setHeader = jest.fn();
    const executionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: opciones.key === undefined ? {} : { 'x-api-key': opciones.key },
        }),
        getResponse: () => ({ setHeader }),
      }),
    } as unknown as ExecutionContext;
    const guard = new BotApiKeyGuard(credenciales, rateLimit, prisma, contexto);
    return { guard, executionContext, contexto, setHeader, autenticar, credenciales };
  };

  it('responde 429 y Retry-After cuando la key supera su límite', async () => {
    const { guard, executionContext, setHeader } = crearGuard({
      key: 'api-key-valida',
      consumir: jest.fn().mockRejectedValue(new IntegracionRateLimitExcedidoError(42)),
    });

    const error = await guard.canActivate(executionContext).catch((causa: unknown) => causa);

    expect(error).toBeInstanceOf(HttpException);
    if (!(error instanceof HttpException)) throw error;
    expect(error.getStatus()).toBe(429);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });

  it('rechaza el request sin header x-api-key', async () => {
    const { guard, executionContext } = crearGuard({ key: undefined });

    await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('autentica la key y fija el tenant y el operador en el contexto', async () => {
    const { guard, executionContext, contexto } = crearGuard({ key: 'api-key-valida' });

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);

    expect(contexto.set).toHaveBeenCalledWith({
      esOperador: false,
      empresaRevendedoraId: 'empresa-1',
      teamMemberId: 'team-1',
    });
    expect(contexto.set).toHaveBeenCalledWith({ operadorPrincipalId: 'operador-1' });
  });

  it('rechaza una Empresa suspendida', async () => {
    const { guard, executionContext } = crearGuard({
      key: 'api-key-valida',
      empresa: { operadorPrincipalId: 'operador-1', estado: 'suspendida' },
    });

    await expect(guard.canActivate(executionContext)).rejects.toMatchObject({ status: 403 });
  });

  it('rechaza un Team Member que no pertenece a la Empresa', async () => {
    const { guard, executionContext } = crearGuard({
      key: 'api-key-valida',
      teamMember: { empresaRevendedoraId: 'empresa-2' },
    });

    await expect(guard.canActivate(executionContext)).rejects.toMatchObject({ status: 403 });
  });
});
