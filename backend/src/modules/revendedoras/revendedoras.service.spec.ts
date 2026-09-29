import { RevendedorasService } from './revendedoras.service';
import { periodoMesArgentina } from '../../common/time/calendario-comercial';

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
        // Las Cuentas importadas son compartidas por defecto.
        esExclusiva: false,
        procedencia: 'importada_proveedor',
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

  it('guarda y audita la parametrización de cuentas de prueba (HU-P01)', async () => {
    const anterior = {
      id: 'empresa-1',
      operadorPrincipalId: 'operador-1',
      razonSocial: 'ISP Demo',
      cuit: '30716009226',
      direccion: 'Calle 1',
      nombreContacto: 'Ana',
      apellidoContacto: 'Perez',
      telefonoContacto: '2611234567',
      emailContacto: 'contacto@isp.com',
      sitioWeb: null,
      cuentasMaxCrearMensual: 10,
      estado: 'activa',
      pruebasHabilitadas: false,
      pruebasCupoMensual: 0,
      pruebasDuracionDias: 0,
      pruebasExtrasPeriodo: 0,
      pruebasAvisosDias: [] as number[],
    };
    const update = jest.fn().mockResolvedValue(anterior);
    const tx = { empresaRevendedora: { update } };
    const prisma = {
      db: {
        empresaRevendedora: {
          findUnique: jest.fn().mockResolvedValue(anterior),
          findFirst: jest.fn(),
        },
      },
      transaction: jest.fn((callback: (cliente: unknown) => unknown) => callback(tx)),
    };
    const registrarEnTx = jest.fn().mockResolvedValue(undefined);
    const service = new RevendedorasService(
      prisma as never,
      { registrarEnTx } as never,
      { operadorPrincipalId: 'operador-1', esOperador: true } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service, 'obtener').mockResolvedValue({ id: 'empresa-1' } as never);

    await service.actualizar('empresa-1', {
      pruebas_habilitadas: true,
      pruebas_cupo_mensual: 5,
      pruebas_duracion_dias: 30,
      pruebas_extras_periodo: 2,
      pruebas_avisos_dias: [7, 3, 1],
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'empresa-1' },
      data: expect.objectContaining({
        pruebasHabilitadas: true,
        pruebasCupoMensual: 5,
        pruebasDuracionDias: 30,
        pruebasExtrasPeriodo: 2,
        // Los extras se estampan con el período vigente (HU-P02).
        pruebasExtrasPeriodoRef: periodoMesArgentina(new Date()),
        pruebasAvisosDias: [7, 3, 1],
      }),
    });
    expect(registrarEnTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        accion: 'actualizacion_empresa_revendedora',
        detalle: expect.objectContaining({
          cambios: expect.objectContaining({
            pruebas_habilitadas: { anterior: false, nuevo: true },
            pruebas_cupo_mensual: { anterior: 0, nuevo: 5 },
            pruebas_avisos_dias: { anterior: '', nuevo: '7,3,1' },
          }),
        }),
      }),
    );
  });

  it('impide a la Empresa Revendedora cambiar la configuración de cuentas de prueba (HU-P01)', async () => {
    const service = new RevendedorasService(
      {} as never,
      {} as never,
      { esOperador: false, empresaRevendedoraId: 'empresa-1' } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.actualizar('empresa-1', { pruebas_habilitadas: true })).rejects.toThrow(
      'Solo el Operador Principal',
    );
  });
});
