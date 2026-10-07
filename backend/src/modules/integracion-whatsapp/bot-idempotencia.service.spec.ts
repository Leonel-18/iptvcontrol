import { CryptoService } from '../../common/crypto/crypto.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { BotIdempotenciaService } from './bot-idempotencia.service';

describe('BotIdempotenciaService', () => {
  it('devuelve la respuesta original sin repetir el alta con la misma clave y payload', async () => {
    const respuesta = { success: true, cliente: { id: 'cliente-1' } };
    let hashSolicitud = '';
    let primeraCreacion = true;
    const solicitudes = {
      create: jest.fn().mockImplementation(({ data }) => {
        if (primeraCreacion) {
          primeraCreacion = false;
          hashSolicitud = data.hashSolicitud;
          return { id: 'solicitud-1' };
        }
        return Promise.reject({ code: 'P2002' });
      }),
      findUnique: jest.fn().mockImplementation(() => ({
        id: 'solicitud-1',
        hashSolicitud,
        estado: 'completada',
        respuestaCifrada: 'respuesta-cifrada',
      })),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      db: {
        solicitudIdempotenciaBot: solicitudes,
      },
    } as unknown as PrismaService;
    const crypto = {
      encrypt: jest.fn().mockReturnValue('respuesta-cifrada'),
      decrypt: jest.fn().mockReturnValue(JSON.stringify(respuesta)),
    } as unknown as CryptoService;
    const contexto = {
      empresaRevendedoraId: 'empresa-1',
    } as unknown as RequestContextService;
    const servicio = new BotIdempotenciaService(prisma, crypto, contexto);
    const ejecutarAlta = jest.fn().mockResolvedValue(respuesta);

    const primera = await servicio.ejecutar(
      '871d63e5-a915-4c21-bbe5-ae68b76eb730',
      { nombre: 'Juan', dni: '30123456' },
      ejecutarAlta,
    );
    const segundaAlta = jest.fn();
    const segunda = await servicio.ejecutar(
      '871d63e5-a915-4c21-bbe5-ae68b76eb730',
      { nombre: 'Juan', dni: '30123456' },
      segundaAlta,
    );

    expect(primera).toEqual(respuesta);
    expect(segunda).toEqual(respuesta);
    expect(ejecutarAlta).toHaveBeenCalledTimes(1);
    expect(segundaAlta).not.toHaveBeenCalled();
    expect(crypto.encrypt).toHaveBeenCalledWith(JSON.stringify(respuesta));
  });

  it('persiste cifrada la respuesta de error para que un reintento no repita el alta', async () => {
    const solicitudes = {
      create: jest.fn().mockResolvedValue({ id: 'solicitud-1' }),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      db: { solicitudIdempotenciaBot: solicitudes },
    } as unknown as PrismaService;
    const encrypt = jest.fn().mockReturnValue('error-cifrado');
    const crypto = {
      encrypt,
      decrypt: jest.fn(),
    } as unknown as CryptoService;
    const contexto = {
      empresaRevendedoraId: 'empresa-1',
    } as unknown as RequestContextService;
    const servicio = new BotIdempotenciaService(prisma, crypto, contexto);
    const error = new BadRequestException('Datos incompletos');

    await expect(
      servicio.ejecutar('871d63e5-a915-4c21-bbe5-ae68b76eb730', { nombre: 'Juan' }, () =>
        Promise.reject(error),
      ),
    ).rejects.toBe(error);

    const respuestaGuardada = JSON.parse(encrypt.mock.calls[0][0] as string);
    expect(respuestaGuardada).toMatchObject({
      success: false,
      error: { code: 'INVALID_DATA' },
    });
    expect(solicitudes.update).toHaveBeenCalledWith({
      where: { id: 'solicitud-1' },
      data: expect.objectContaining({
        estado: 'fallida',
        respuestaCifrada: 'error-cifrado',
        finalizadaEn: expect.any(Date),
      }),
    });
  });

  it('rechaza una Idempotency-Key reutilizada con datos diferentes', async () => {
    const prisma = {
      db: {
        solicitudIdempotenciaBot: {
          create: jest.fn().mockRejectedValue({ code: 'P2002' }),
          findUnique: jest.fn().mockResolvedValue({
            id: 'solicitud-1',
            hashSolicitud: 'hash-de-otro-request',
            estado: 'completada',
            respuestaCifrada: 'respuesta-cifrada',
          }),
          update: jest.fn(),
        },
      },
    } as unknown as PrismaService;
    const contexto = {
      empresaRevendedoraId: 'empresa-1',
    } as unknown as RequestContextService;
    const servicio = new BotIdempotenciaService(prisma, {} as CryptoService, contexto);

    const error = await servicio
      .ejecutar('871d63e5-a915-4c21-bbe5-ae68b76eb730', { nombre: 'Otro cliente' }, jest.fn())
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ConflictException);
    if (!(error instanceof ConflictException)) throw error;
    expect(error.getResponse()).toMatchObject({ error: 'IdempotencyConflict' });
  });

  it('exige una Idempotency-Key con formato UUID', async () => {
    const servicio = new BotIdempotenciaService(
      {} as PrismaService,
      {} as CryptoService,
      {} as RequestContextService,
    );

    await expect(servicio.ejecutar('clave-repetible', {}, jest.fn())).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'IdempotencyKeyRequired' }),
    });
  });
});
