import { RevendedorasService } from './revendedoras.service';

describe('RevendedorasService', () => {
  it('devuelve sólo las Cuentas del Proveedor que no existen en IPTVControl', async () => {
    const prisma = {
      db: {
        cuenta: {
          findMany: jest.fn().mockResolvedValue([
            { proveedorCuentaId: '30000001', dniAltaSensa: '30000001' },
            { proveedorCuentaId: null, dniAltaSensa: '30000002' },
          ]),
        },
      },
    };
    const contexto = { operadorPrincipalId: 'operador-1' };
    const proveedor = {
      listarCuentas: jest.fn().mockResolvedValue([
        {
          proveedorCuentaId: '30000001',
          dni: '30000001',
          nombre: 'Cuenta',
          apellido: 'Interna',
          email: 'interna@isp.com',
          ciudad: 'Mendoza',
          activa: true,
        },
        {
          proveedorCuentaId: '39999999',
          dni: '39999999',
          nombre: 'Cuenta',
          apellido: 'Externa',
          email: 'externa@isp.com',
          ciudad: 'Godoy Cruz',
          referenciaExterna: 'CRM99',
          activa: false,
        },
      ]),
    };
    const service = new RevendedorasService(
      prisma as never,
      {} as never,
      contexto as never,
      {} as never,
      proveedor as never,
      {} as never,
      {} as never,
    );

    const resultado = await service.listarCuentasExternas();

    expect(proveedor.listarCuentas).toHaveBeenCalledWith('operador-1');
    expect(prisma.db.cuenta.findMany).toHaveBeenCalledWith({
      where: { empresaRevendedora: { operadorPrincipalId: 'operador-1' } },
      select: { proveedorCuentaId: true, dniAltaSensa: true },
    });
    expect(resultado.resumen).toEqual({
      cuentas_proveedor: 2,
      cuentas_iptvcontrol: 2,
      cuentas_externas: 1,
    });
    expect(resultado.cuentas).toEqual([
      {
        proveedor_cuenta_id: '39999999',
        dni: '39999999',
        nombre: 'Cuenta',
        apellido: 'Externa',
        email: 'externa@isp.com',
        ciudad: 'Godoy Cruz',
        referencia_externa: 'CRM99',
        fecha_alta: null,
        estado: 'inactiva',
      },
    ]);
    expect(resultado.cuentas[0]).not.toHaveProperty('pin');
    expect(resultado.cuentas[0]).not.toHaveProperty('password');
  });

  it('importa cada Cuenta de forma independiente y deja la contraseña pendiente', async () => {
    const cuentaCreate = jest.fn().mockResolvedValue({ id: 'cuenta-nueva' });
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      cuenta: { findFirst: jest.fn().mockResolvedValue(null), create: cuentaCreate },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      db: {
        empresaRevendedora: { findFirst: jest.fn().mockResolvedValue({ id: 'empresa-1' }) },
      },
      transaction: jest.fn((callback) => callback(tx)),
    };
    const proveedor = {
      resolver: jest.fn().mockResolvedValue({ configuracion: { proveedorId: 'proveedor-1' } }),
      listarCuentas: jest.fn().mockResolvedValue([
        {
          proveedorCuentaId: '30000003',
          dni: '30000003',
          nombre: 'Cuenta',
          apellido: 'Importada',
          email: 'importada@isp.com',
          ciudad: 'Mendoza',
          pin: '123456',
          servicios: '3|1',
          dispositivosFijos: 2,
          dispositivosMoviles: 1,
          activa: true,
        },
      ]),
    };
    const audit = { registrarEnTx: jest.fn().mockResolvedValue(undefined) };
    const inventario = { sincronizar: jest.fn().mockResolvedValue({}) };
    const crypto = { encrypt: jest.fn((value) => `cifrado:${value}`) };
    const service = new RevendedorasService(
      prisma as never,
      audit as never,
      { operadorPrincipalId: 'operador-1' } as never,
      {} as never,
      proveedor as never,
      crypto as never,
      inventario as never,
    );

    const resultado = await service.importarCuentasExternas({
      empresa_revendedora_id: 'empresa-1',
      proveedor_cuenta_ids: ['30000003', '30000999'],
    });

    expect(resultado.resumen).toEqual({
      solicitadas: 2,
      importadas: 1,
      ya_importadas: 0,
      fallidas: 1,
    });
    expect(cuentaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        empresaRevendedoraId: 'empresa-1',
        proveedorId: 'proveedor-1',
        proveedorCuentaId: '30000003',
        dniAltaSensa: '30000003',
        passwordCifrado: null,
        pinCifrado: 'cifrado:123456',
        esExclusiva: true,
        servicios: '1|3',
      }),
    });
    expect(inventario.sincronizar).toHaveBeenCalledWith('cuenta-nueva');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        accion: 'alta_cuenta',
        detalle: expect.objectContaining({ origen: 'importacion_proveedor' }),
      }),
    );
  });

  it('trata como idempotente una Cuenta que ya fue importada', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      cuenta: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cuenta-existente' }),
        create: jest.fn(),
      },
    };
    const prisma = {
      db: {
        empresaRevendedora: { findFirst: jest.fn().mockResolvedValue({ id: 'empresa-1' }) },
      },
      transaction: jest.fn((callback) => callback(tx)),
    };
    const proveedor = {
      resolver: jest.fn().mockResolvedValue({ configuracion: { proveedorId: 'proveedor-1' } }),
      listarCuentas: jest.fn().mockResolvedValue([
        {
          proveedorCuentaId: '30000003',
          dni: '30000003',
          email: 'importada@isp.com',
          pin: '123456',
          activa: true,
        },
      ]),
    };
    const inventario = { sincronizar: jest.fn() };
    const service = new RevendedorasService(
      prisma as never,
      {} as never,
      { operadorPrincipalId: 'operador-1' } as never,
      {} as never,
      proveedor as never,
      {} as never,
      inventario as never,
    );

    const resultado = await service.importarCuentasExternas({
      empresa_revendedora_id: 'empresa-1',
      proveedor_cuenta_ids: ['30000003'],
    });

    expect(resultado.resumen).toEqual({
      solicitadas: 1,
      importadas: 0,
      ya_importadas: 1,
      fallidas: 0,
    });
    expect(tx.cuenta.create).not.toHaveBeenCalled();
    expect(inventario.sincronizar).not.toHaveBeenCalled();
  });

  it('elimina una Cuenta externa sólo cuando SENSA no informa Dispositivos', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      cuenta: { findFirst: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { transaction: jest.fn((callback) => callback(tx)) };
    const proveedor = {
      consultarCuenta: jest.fn().mockResolvedValue({ proveedorCuentaId: '30000004' }),
      listarDispositivos: jest.fn().mockResolvedValue([]),
      cerrarCuenta: jest.fn().mockResolvedValue(undefined),
    };
    const audit = { registrarEnTx: jest.fn().mockResolvedValue(undefined) };
    const service = new RevendedorasService(
      prisma as never,
      audit as never,
      { operadorPrincipalId: 'operador-1' } as never,
      {} as never,
      proveedor as never,
      {} as never,
      {} as never,
    );

    await expect(service.cerrarCuentaExterna('30000004')).resolves.toEqual({
      proveedor_cuenta_id: '30000004',
      estado: 'eliminada',
    });
    expect(proveedor.cerrarCuenta).toHaveBeenCalledWith('operador-1', '30000004');
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        accion: 'cierre_cuenta',
        detalle: expect.objectContaining({ origen: 'cuenta_externa' }),
      }),
    );
  });

  it('bloquea la eliminación externa cuando SENSA informa Dispositivos', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      cuenta: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prisma = { transaction: jest.fn((callback) => callback(tx)) };
    const proveedor = {
      consultarCuenta: jest.fn().mockResolvedValue({ proveedorCuentaId: '30000005' }),
      listarDispositivos: jest.fn().mockResolvedValue([{ proveedorDeviceId: 'device-1' }]),
      cerrarCuenta: jest.fn(),
    };
    const service = new RevendedorasService(
      prisma as never,
      {} as never,
      { operadorPrincipalId: 'operador-1' } as never,
      {} as never,
      proveedor as never,
      {} as never,
      {} as never,
    );

    await expect(service.cerrarCuentaExterna('30000005')).rejects.toThrow(
      'No se puede eliminar: SENSA informa 1 Dispositivo(s)',
    );
    expect(proveedor.cerrarCuenta).not.toHaveBeenCalled();
  });
});
