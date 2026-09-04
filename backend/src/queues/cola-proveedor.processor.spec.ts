import { EstadoDispositivo, EstadoSolicitudVinculacion } from '@prisma/client';
import { ColaProveedorProcessor } from './cola-proveedor.processor';
import { TRABAJOS_PROVEEDOR } from './cola-proveedor.constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProveedorService } from '../proveedor/proveedor.service';
import { AuditService } from '../common/audit/audit.service';
import { ColaProveedorService } from './cola-proveedor.service';
import { CuentasProvisioningService } from '../modules/cuentas/cuentas-provisioning.service';

/**
 * =============================================================================
 * Casos reales: Usuario 131 y limpieza de filas vacías (24/08/2026)
 * =============================================================================
 * Cuenta exclusiva, ventana de vinculación vencida sin ningún candidato
 * detectado (el equipo se conectó a SENSA recién después de los 10 minutos).
 * Antes, al vencer, se borraba también el Cliente Final del Dispositivo — el
 * sistema "olvidaba" que la Cuenta ya tenía dueño y el próximo alta creaba una
 * Cuenta nueva. Este test fija que, en una Cuenta exclusiva, el vínculo se
 * preserva (la fila "disponible" queda como marcador de dueño); en una
 * compartida, la fila "fantasma" se borra (nunca tuvo MAC ni
 * proveedor_device_id), pero la venta 1+1/2+2 NO se cancela: queda reservada
 * para que el Cliente Final cargue sus Dispositivos más adelante (Fase F).
 * =============================================================================
 */
describe('ColaProveedorProcessor — vencimiento de ventana de vinculación', () => {
  const solicitudBase = {
    id: 'solicitud-1',
    dispositivoId: 'dispositivo-1',
    cuentaId: 'cuenta-1',
    empresaRevendedoraId: 'empresa-1',
    estado: EstadoSolicitudVinculacion.observando,
    expiraEn: new Date(Date.now() - 60_000), // ya venció
    creaVentaCompartida: true,
    dispositivo: { clienteFinalId: 'cliente-usuario-131', estadoVinculacion: 'observando' },
  };

  const crearProcesador = (esExclusiva: boolean) => {
    const dispositivoUpdate = jest.fn().mockResolvedValue(undefined);
    const dispositivoDelete = jest.fn().mockResolvedValue(undefined);
    const ventaDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const solicitudUpdate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      solicitudVinculacionDispositivo: {
        findUnique: jest.fn().mockResolvedValue({
          ...solicitudBase,
          cuenta: { esExclusiva, proveedorCuentaId: '30000042' },
        }),
        update: solicitudUpdate,
      },
      dispositivo: {
        update: dispositivoUpdate,
        delete: dispositivoDelete,
        count: jest.fn().mockResolvedValue(0),
      },
      ventaCompartida: { deleteMany: ventaDeleteMany },
      ventanaCuriosidad: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    const prisma = {
      transactionComoOperador: jest
        .fn()
        .mockImplementation((_op: string, fn: (tx: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const provisioning = {
      sincronizarContadoresVenta: jest.fn().mockResolvedValue(undefined),
    } as unknown as CuentasProvisioningService;

    const proveedor = {} as unknown as ProveedorService;
    const audit = {} as unknown as AuditService;
    const cola = {
      encolarSincronizacionContadoresVenta: jest.fn().mockResolvedValue(undefined),
    } as unknown as ColaProveedorService;

    const procesador = new ColaProveedorProcessor(prisma, proveedor, audit, cola, provisioning);
    return { procesador, dispositivoUpdate, dispositivoDelete, ventaDeleteMany, provisioning, tx };
  };

  it('preserva el Cliente Final al vencer la ventana de una Cuenta exclusiva (no la borra)', async () => {
    const { procesador, dispositivoUpdate, dispositivoDelete, provisioning } =
      crearProcesador(true);

    await procesador.process({
      name: TRABAJOS_PROVEEDOR.SONDEAR_VINCULACION,
      data: { solicitudId: 'solicitud-1', operadorPrincipalId: 'operador-1', intento: 1 },
    } as never);

    expect(dispositivoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: EstadoDispositivo.disponible,
          clienteFinalId: 'cliente-usuario-131',
        }),
      }),
    );
    expect(dispositivoDelete).not.toHaveBeenCalled();
    // Una Cuenta exclusiva nunca toca los contadores de venta.
    expect(provisioning.sincronizarContadoresVenta).not.toHaveBeenCalled();
  });

  it('borra la fila del Dispositivo al vencer la ventana de una Cuenta compartida (nunca tuvo MAC ni dueño)', async () => {
    const { procesador, dispositivoUpdate, dispositivoDelete, provisioning } =
      crearProcesador(false);

    await procesador.process({
      name: TRABAJOS_PROVEEDOR.SONDEAR_VINCULACION,
      data: { solicitudId: 'solicitud-1', operadorPrincipalId: 'operador-1', intento: 1 },
    } as never);

    expect(dispositivoDelete).toHaveBeenCalledWith({ where: { id: 'dispositivo-1' } });
    expect(dispositivoUpdate).not.toHaveBeenCalled();
    expect(provisioning.sincronizarContadoresVenta).toHaveBeenCalledWith('cuenta-1', 'operador-1');
  });

  it('no libera la venta si sólo vence el intento de agregar un Dispositivo a una venta existente', async () => {
    const { procesador, ventaDeleteMany, tx } = crearProcesador(false);
    tx.solicitudVinculacionDispositivo.findUnique.mockResolvedValue({
      ...solicitudBase,
      creaVentaCompartida: false,
      cuenta: { esExclusiva: false, proveedorCuentaId: '30000042' },
    });

    await procesador.process({
      name: TRABAJOS_PROVEEDOR.SONDEAR_VINCULACION,
      data: { solicitudId: 'solicitud-1', operadorPrincipalId: 'operador-1', intento: 1 },
    } as never);

    expect(ventaDeleteMany).not.toHaveBeenCalled();
  });

  it('Opción A: al vencer una venta nueva compartida sin equipos, la venta conserva su cupo técnico', async () => {
    const { procesador, dispositivoDelete, ventaDeleteMany, tx, provisioning } =
      crearProcesador(false);

    await procesador.process({
      name: TRABAJOS_PROVEEDOR.SONDEAR_VINCULACION,
      data: { solicitudId: 'solicitud-1', operadorPrincipalId: 'operador-1', intento: 1 },
    } as never);

    // La venta reservada NO se borra ni se cierra su Ventana de Alta (vence sola).
    expect(ventaDeleteMany).not.toHaveBeenCalled();
    expect(tx.ventanaCuriosidad.updateMany).not.toHaveBeenCalled();
    // La solicitud expira y la fila "fantasma" se limpia.
    expect(tx.solicitudVinculacionDispositivo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: EstadoSolicitudVinculacion.expirado }),
      }),
    );
    expect(dispositivoDelete).toHaveBeenCalledWith({ where: { id: 'dispositivo-1' } });
    // Se re-sincroniza el contador contra las ventas reales: como la venta se
    // conserva, el cupo técnico reservado queda intacto para el Cliente Final.
    expect(provisioning.sincronizarContadoresVenta).toHaveBeenCalledWith(
      'cuenta-1',
      'operador-1',
    );
  });
});
