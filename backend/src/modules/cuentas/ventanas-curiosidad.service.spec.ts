import { MotivoFinVentanaCuriosidad } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { PrismaService, TransactionClient } from '../../common/prisma/prisma.service';
import {
  CuentaAisladaError,
  CuentaEnVentanaCuriosidadError,
  VentanasCuriosidadService,
} from './ventanas-curiosidad.service';

describe('VentanasCuriosidadService', () => {
  const crear = (opciones?: { predeterminada?: number; activaHasta?: Date | null }) => {
    const ventanaCreate = jest
      .fn()
      .mockImplementation(({ data }) => ({ id: 'ventana-1', ...data }));
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      ventanaCuriosidad: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            opciones?.activaHasta ? { finPrevistoEn: opciones.activaHasta } : null,
          ),
        create: ventanaCreate,
      },
      empresaRevendedora: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          duracionVentanaCuriosidadMinutos: opciones?.predeterminada ?? 1440,
        }),
      },
    } as unknown as TransactionClient;
    const audit = {
      registrarEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const servicio = new VentanasCuriosidadService(
      {} as PrismaService,
      {} as RequestContextService,
      audit,
    );
    return { servicio, tx, ventanaCreate, audit };
  };

  it('abre una ventana reducida y conserva el predeterminado histórico', async () => {
    const { servicio, tx, ventanaCreate, audit } = crear({ predeterminada: 1440 });

    await servicio.abrirPorNuevaVentaEnTx(tx, {
      cuentaId: 'cuenta-1',
      clienteFinalId: 'cliente-1',
      empresaRevendedoraId: 'empresa-1',
      ventaCompartidaId: 'venta-1',
      duracionSolicitadaMinutos: 120,
      teamMemberId: 'team-1',
    });

    expect(ventanaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        duracionPredeterminadaMinutos: 1440,
        duracionAplicadaMinutos: 120,
        finRealEn: null,
        iniciadaPorTeamMemberId: 'team-1',
      }),
    });
    expect(audit.registrarEnTx).toHaveBeenCalled();
  });

  it('admite 0 minutos sin bloquear la Cuenta', async () => {
    const { servicio, tx, ventanaCreate } = crear({ predeterminada: 60 });

    await servicio.abrirPorNuevaVentaEnTx(tx, {
      cuentaId: 'cuenta-1',
      clienteFinalId: 'cliente-1',
      empresaRevendedoraId: 'empresa-1',
      ventaCompartidaId: 'venta-1',
      duracionSolicitadaMinutos: 0,
    });

    expect(ventanaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        duracionAplicadaMinutos: 0,
        finRealEn: expect.any(Date),
        motivoFin: MotivoFinVentanaCuriosidad.vencimiento,
      }),
    });
  });

  it('admite una duración superior a la predeterminada (no es un tope)', async () => {
    const { servicio, tx, ventanaCreate } = crear({ predeterminada: 60 });

    await servicio.abrirPorNuevaVentaEnTx(tx, {
      cuentaId: 'cuenta-1',
      clienteFinalId: 'cliente-1',
      empresaRevendedoraId: 'empresa-1',
      ventaCompartidaId: 'venta-1',
      duracionSolicitadaMinutos: 120,
    });

    expect(ventanaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        duracionPredeterminadaMinutos: 60,
        duracionAplicadaMinutos: 120,
        finRealEn: null,
      }),
    });
  });

  it('rechaza una duración negativa o no entera', async () => {
    const { servicio, tx, ventanaCreate } = crear({ predeterminada: 60 });

    await expect(
      servicio.abrirPorNuevaVentaEnTx(tx, {
        cuentaId: 'cuenta-1',
        clienteFinalId: 'cliente-1',
        empresaRevendedoraId: 'empresa-1',
        ventaCompartidaId: 'venta-1',
        duracionSolicitadaMinutos: -5,
      }),
    ).rejects.toThrow('mayor o igual a 0');
    expect(ventanaCreate).not.toHaveBeenCalled();
  });

  it('impide una venta nueva mientras la Cuenta sigue bloqueada', async () => {
    const fin = new Date(Date.now() + 60_000);
    const { servicio, tx } = crear({ activaHasta: fin });

    await expect(
      servicio.abrirPorNuevaVentaEnTx(tx, {
        cuentaId: 'cuenta-1',
        clienteFinalId: 'cliente-2',
        empresaRevendedoraId: 'empresa-1',
        ventaCompartidaId: 'venta-2',
      }),
    ).rejects.toBeInstanceOf(CuentaEnVentanaCuriosidadError);
  });
});

describe('VentanasCuriosidadService — apertura manual', () => {
  const crear = (
    opciones: { esExclusiva?: boolean; ventaActiva?: boolean; hayCliente?: boolean } = {},
  ) => {
    const ventanaCreate = jest
      .fn()
      .mockImplementation(({ data }) => ({ id: 'ventana-manual', ...data }));
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      cuenta: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cuenta-1',
          esExclusiva: opciones.esExclusiva ?? false,
          empresaRevendedoraId: 'empresa-1',
        }),
      },
      ventanaCuriosidad: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            opciones.ventaActiva ? { finPrevistoEn: new Date(Date.now() + 60_000) } : null,
          ),
        create: ventanaCreate,
      },
      ventaCompartida: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            opciones.hayCliente === false ? null : { clienteFinalId: 'cliente-1' },
          ),
      },
      empresaRevendedora: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ duracionVentanaCuriosidadMinutos: 1440 }),
      },
    } as unknown as TransactionClient;
    const audit = {
      registrarEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const prisma = {
      transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const contexto = {
      esOperador: false,
      empresaRevendedoraId: 'empresa-1',
      teamMemberId: 'team-1',
    } as unknown as RequestContextService;

    const servicio = new VentanasCuriosidadService(prisma, contexto, audit);
    return { servicio, ventanaCreate };
  };

  it('abre una ventana manual atada a un cliente existente', async () => {
    const { servicio, ventanaCreate } = crear();

    await servicio.abrirManualmente('cuenta-1', 1440);

    expect(ventanaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cuentaId: 'cuenta-1',
        clienteFinalId: 'cliente-1',
        ventaCompartidaId: null,
        duracionAplicadaMinutos: 1440,
      }),
    });
  });

  it('rechaza si la Cuenta ya tiene una ventana activa', async () => {
    const { servicio, ventanaCreate } = crear({ ventaActiva: true });

    await expect(servicio.abrirManualmente('cuenta-1', 1440)).rejects.toThrow(
      'ya tiene una Ventana',
    );
    expect(ventanaCreate).not.toHaveBeenCalled();
  });

  it('rechaza si la Cuenta no tiene clientes', async () => {
    const { servicio } = crear({ hayCliente: false });

    await expect(servicio.abrirManualmente('cuenta-1', 1440)).rejects.toThrow(
      'al menos un Cliente',
    );
  });

  it('rechaza una duración de 0', async () => {
    const { servicio, ventanaCreate } = crear();

    await expect(servicio.abrirManualmente('cuenta-1', 0)).rejects.toThrow('mayor a 0');
    expect(ventanaCreate).not.toHaveBeenCalled();
  });
});

/**
 * HU-A02 — una Cuenta aislada bloquea el ingreso de Clientes Finales nuevos,
 * igual que una Ventana de Alta vigente.
 */
describe('VentanasCuriosidadService — aislamiento de Cuenta', () => {
  const crear = (finAislamiento: Date | null) => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      cuenta: {
        findUnique: jest.fn().mockResolvedValue({
          aislada: finAislamiento !== null,
          aislamientoFinEn: finAislamiento,
        }),
      },
      ventanaCuriosidad: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as TransactionClient;
    const prisma = {
      transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const servicio = new VentanasCuriosidadService(
      prisma,
      {} as RequestContextService,
      {} as AuditService,
    );
    return { servicio };
  };

  it('bloquea a un Cliente Final nuevo mientras el aislamiento está vigente', async () => {
    const { servicio } = crear(new Date(Date.now() + 86_400_000));

    await expect(
      servicio.asegurarClientePermitido('cuenta-1', 'cliente-nuevo'),
    ).rejects.toBeInstanceOf(CuentaAisladaError);
  });

  it('no bloquea si el aislamiento ya venció', async () => {
    const { servicio } = crear(new Date(Date.now() - 86_400_000));

    await expect(
      servicio.asegurarClientePermitido('cuenta-1', 'cliente-nuevo'),
    ).resolves.toBeUndefined();
  });
});
