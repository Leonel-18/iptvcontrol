import { PruebasService } from './pruebas.service';
import { periodoMesArgentina } from '../../common/time/calendario-comercial';

const EMPRESA_BASE = {
  pruebasHabilitadas: true,
  pruebasCupoMensual: 15,
  pruebasDuracionDias: 30,
  pruebasExtrasPeriodo: 3,
  pruebasExtrasPeriodoRef: null as string | null,
  pruebasAvisosDias: [7, 3],
};

function armarServicio(opciones: {
  empresa?: Partial<typeof EMPRESA_BASE>;
  consumidas?: number;
  contexto?: Record<string, unknown>;
}) {
  const tx = {
    empresaRevendedora: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ ...EMPRESA_BASE, ...(opciones.empresa ?? {}) }),
    },
    consumoCuentaPrueba: {
      count: jest.fn().mockResolvedValue(opciones.consumidas ?? 0),
      create: jest.fn().mockResolvedValue({ id: 'consumo-1' }),
    },
  };
  const prisma = { transaction: jest.fn((callback: (t: unknown) => unknown) => callback(tx)) };
  const contexto = opciones.contexto ?? {
    esOperador: false,
    empresaRevendedoraId: 'empresa-1',
  };
  const service = new PruebasService(prisma as never, contexto as never);
  return { service, tx, prisma };
}

describe('PruebasService', () => {
  it('suma cupo + extras del período vigente y descuenta el consumo', async () => {
    const periodo = periodoMesArgentina(new Date());
    const { service, tx } = armarServicio({
      empresa: { pruebasExtrasPeriodoRef: periodo },
      consumidas: 18,
    });

    const estado = await service.obtenerEstado('empresa-1');

    expect(estado).toEqual({
      periodo,
      habilitadas: true,
      cupo_mensual: 15,
      extras: 3,
      total: 18,
      consumidas: 18,
      disponible: 0,
      duracion_dias: 30,
      avisos_dias: [7, 3],
    });
    expect(tx.consumoCuentaPrueba.count).toHaveBeenCalledWith({
      where: {
        empresaRevendedoraId: 'empresa-1',
        consumidaEn: { gte: expect.any(Date), lt: expect.any(Date) },
      },
    });
  });

  it('ignora los extras cuando pertenecen a un período anterior', async () => {
    const { service } = armarServicio({ empresa: { pruebasExtrasPeriodoRef: '2020-01' } });

    const estado = await service.obtenerEstado('empresa-1');

    expect(estado.extras).toBe(0);
    expect(estado.total).toBe(15);
    expect(estado.disponible).toBe(15);
  });

  it('nunca informa disponible negativo cuando el consumo supera el cupo', async () => {
    const { service } = armarServicio({ consumidas: 20 });

    const estado = await service.obtenerEstado('empresa-1');

    expect(estado.disponible).toBe(0);
  });

  it('bloquea el alta si el módulo está deshabilitado', async () => {
    const { service, tx } = armarServicio({ empresa: { pruebasHabilitadas: false } });

    await expect(service.asegurarDisponibilidad('empresa-1', tx as never)).rejects.toThrow(
      'deshabilitado',
    );
  });

  it('bloquea el alta al alcanzar cupo + extras aunque las pruebas ya no estén activas', async () => {
    const { service, tx } = armarServicio({ consumidas: 15 });

    await expect(service.asegurarDisponibilidad('empresa-1', tx as never)).rejects.toThrow(
      'No hay cupo de cuentas de prueba disponible',
    );
  });

  it('habilita el alta cuando hay cupo disponible', async () => {
    const { service, tx } = armarServicio({ consumidas: 14 });

    await expect(service.asegurarDisponibilidad('empresa-1', tx as never)).resolves.toMatchObject({
      disponible: 1,
    });
  });

  it('registra el consumo como fila append-only', async () => {
    const { service, tx } = armarServicio({});

    await service.registrarConsumo(
      { empresaRevendedoraId: 'empresa-1', cuentaId: 'cuenta-9' },
      tx as never,
    );

    expect(tx.consumoCuentaPrueba.create).toHaveBeenCalledWith({
      data: { empresaRevendedoraId: 'empresa-1', cuentaId: 'cuenta-9' },
    });
  });

  it('reserva la consulta al panel de la Empresa Revendedora', async () => {
    const { service } = armarServicio({
      contexto: { esOperador: true, empresaRevendedoraId: null },
    });

    await expect(service.obtenerParaRevendedor()).rejects.toThrow('Empresa Revendedora');
  });
});
