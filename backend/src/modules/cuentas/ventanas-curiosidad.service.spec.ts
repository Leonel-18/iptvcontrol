import { MotivoFinVentanaCuriosidad } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { PrismaService, TransactionClient } from '../../common/prisma/prisma.service';
import {
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
