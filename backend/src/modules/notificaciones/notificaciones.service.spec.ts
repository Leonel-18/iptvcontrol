import { NotFoundException } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';

/** Arma el servicio con las dependencias mínimas simuladas. */
const crearServicio = (
  opciones: {
    contexto?: Record<string, unknown>;
    listado?: unknown[];
    existentePorClave?: unknown;
    notificacionPorId?: unknown;
    pendientes?: { id: string }[];
  } = {},
) => {
  const notificacion = {
    findMany: jest.fn().mockResolvedValue(opciones.pendientes ?? opciones.listado ?? []),
    findUnique: jest.fn().mockResolvedValue(opciones.existentePorClave ?? null),
    findFirst: jest.fn().mockResolvedValue(opciones.notificacionPorId ?? null),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'nueva',
      ...data,
    })),
  };
  const notificacionLectura = {
    upsert: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  const prisma = {
    db: { notificacion, notificacionLectura },
    transaction: jest
      .fn()
      .mockImplementation((fn: (tx: unknown) => unknown) => fn({ notificacion })),
  } as unknown as PrismaService;
  const contexto = {
    esOperador: false,
    empresaRevendedoraId: 'empresa-1',
    teamMemberId: 'team-1',
    ...(opciones.contexto ?? {}),
  } as unknown as RequestContextService;

  return {
    servicio: new NotificacionesService(prisma, contexto),
    notificacion,
    notificacionLectura,
  };
};

describe('NotificacionesService (HU-N01)', () => {
  it('lista con el estado leído del usuario y cuenta las no leídas', async () => {
    const { servicio } = crearServicio({
      listado: [
        {
          id: 'n1',
          tipo: 'prueba_por_vencer',
          titulo: 'Prueba por vencer',
          mensaje: 'Vence en 3 días',
          accionTipo: 'ver_cuenta',
          accionRefId: 'cuenta-1',
          creadoEn: new Date('2026-09-29T10:00:00Z'),
          lecturas: [],
        },
        {
          id: 'n2',
          tipo: 'ventana_alta_por_vencer',
          titulo: 'Ventana por vencer',
          mensaje: 'Vence pronto',
          accionTipo: 'ver_cuenta',
          accionRefId: 'cuenta-2',
          creadoEn: new Date('2026-09-28T10:00:00Z'),
          lecturas: [{ leidoEn: new Date('2026-09-28T11:00:00Z') }],
        },
      ],
    });

    const resultado = await servicio.listar();

    expect(resultado.no_leidas).toBe(1);
    expect(resultado.data[0]).toMatchObject({ id: 'n1', leida: false, leida_en: null });
    expect(resultado.data[1]).toMatchObject({ id: 'n2', leida: true });
  });

  it('no duplica una notificación con la misma clave para el tenant', async () => {
    const { servicio, notificacion } = crearServicio({ existentePorClave: { id: 'existente' } });

    const resultado = await servicio.crear({
      empresaRevendedoraId: 'empresa-1',
      tipo: 'prueba_por_vencer',
      titulo: 'T',
      mensaje: 'M',
      clave: 'prueba_por_vencer:cuenta-1:3',
    });

    expect(resultado).toEqual({ id: 'existente', creada: false });
    expect(notificacion.create).not.toHaveBeenCalled();
  });

  it('crea la notificación cuando no hay una con la misma clave', async () => {
    const { servicio, notificacion } = crearServicio();

    await servicio.crear({
      empresaRevendedoraId: 'empresa-1',
      tipo: 'prueba_por_vencer',
      titulo: 'T',
      mensaje: 'M',
      accionTipo: 'ver_cuenta',
      accionRefId: 'cuenta-1',
      clave: 'clave-1',
    });

    expect(notificacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ empresaRevendedoraId: 'empresa-1', clave: 'clave-1' }),
      }),
    );
  });

  it('marca una notificación como leída para el usuario actual', async () => {
    const { servicio, notificacionLectura } = crearServicio({ notificacionPorId: { id: 'n1' } });

    await servicio.marcarLeida('n1');

    expect(notificacionLectura.upsert).toHaveBeenCalledWith({
      where: { notificacionId_teamMemberId: { notificacionId: 'n1', teamMemberId: 'team-1' } },
      create: { notificacionId: 'n1', teamMemberId: 'team-1', empresaRevendedoraId: 'empresa-1' },
      update: {},
    });
  });

  it('rechaza marcar una notificación inexistente', async () => {
    const { servicio } = crearServicio({ notificacionPorId: null });

    await expect(servicio.marcarLeida('n1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marca como leídas todas las pendientes del usuario', async () => {
    const { servicio, notificacionLectura } = crearServicio({
      pendientes: [{ id: 'n1' }, { id: 'n2' }],
    });

    const resultado = await servicio.marcarTodasLeidas();

    expect(notificacionLectura.createMany).toHaveBeenCalledWith({
      data: [
        { notificacionId: 'n1', teamMemberId: 'team-1', empresaRevendedoraId: 'empresa-1' },
        { notificacionId: 'n2', teamMemberId: 'team-1', empresaRevendedoraId: 'empresa-1' },
      ],
      skipDuplicates: true,
    });
    expect(resultado).toEqual({ marcadas: 2 });
  });

  it('reserva el centro al panel de la Empresa Revendedora', async () => {
    const { servicio } = crearServicio({
      contexto: { esOperador: true, empresaRevendedoraId: null },
    });

    await expect(servicio.listar()).rejects.toThrow('Empresa Revendedora');
  });
});
