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
        estado: 'inactiva',
      },
    ]);
    expect(resultado.cuentas[0]).not.toHaveProperty('pin');
    expect(resultado.cuentas[0]).not.toHaveProperty('password');
  });
});
