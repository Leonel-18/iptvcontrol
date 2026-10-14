import { EntidadAuditada } from '@prisma/client';
import { AuditoriaService } from './auditoria.service';

describe('AuditoriaService', () => {
  const construir = () => {
    const prisma = {
      db: {
        auditLog: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    };
    const contexto = { esOperador: false };
    const service = new AuditoriaService(prisma as never, contexto as never);
    return { service, prisma };
  };

  it('trae la actividad de una Cuenta por entidad o por cuenta_id en el detalle', async () => {
    const { service, prisma } = construir();

    await service.listar({ account_id: 'cuenta-1', page: 1, per_page: 10 } as never);

    expect(prisma.db.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { entidadAfectada: EntidadAuditada.Cuenta, entidadId: 'cuenta-1' },
            { detalle: { path: ['cuenta_id'], equals: 'cuenta-1' } },
          ],
        }),
      }),
    );
  });

  it('no agrega el OR de Cuenta cuando no se filtra por cuenta', async () => {
    const { service, prisma } = construir();

    await service.listar({ page: 1, per_page: 10 } as never);

    const argumentos = prisma.db.auditLog.findMany.mock.calls[0][0] as {
      where: { OR?: unknown };
    };
    expect(argumentos.where.OR).toBeUndefined();
  });
});
