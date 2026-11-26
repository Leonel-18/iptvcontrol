import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PortalClienteService } from './portal-cliente.service';

describe('PortalClienteService — cambios por ID de cuenta del proveedor', () => {
  const construir = (cuenta: Record<string, unknown> | null) => {
    const prisma = {
      db: {
        cuenta: {
          findFirst: jest.fn().mockResolvedValue(cuenta),
        },
      },
    };
    const contexto = { empresaRevendedoraId: 'empresa-1' };
    const cuentas = {
      cambiarPassword: jest.fn().mockResolvedValue({ id: 'cuenta-1' }),
      cambiarPin: jest.fn().mockResolvedValue({ id: 'cuenta-1' }),
      actualizarPropiedades: jest.fn().mockResolvedValue({ id: 'cuenta-1' }),
    };
    const service = new PortalClienteService(
      prisma as never,
      contexto as never,
      cuentas as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, cuentas, prisma };
  };

  const cuentaCompartida = {
    id: 'cuenta-1',
    proveedorCuentaId: '3000002',
    empresaRevendedoraId: 'empresa-1',
    esExclusiva: false,
    clienteFinalExclusivoId: null,
    estado: 'activa',
  };

  const cuentaExclusiva = {
    ...cuentaCompartida,
    esExclusiva: true,
    clienteFinalExclusivoId: 'cliente-1',
  };

  it('pide confirmación explícita para cambiar la contraseña de una Cuenta compartida', async () => {
    const { service, cuentas } = construir(cuentaCompartida);

    await expect(
      service.cambiarPassword('3000002', '12345678'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(cuentas.cambiarPassword).not.toHaveBeenCalled();
  });

  it('permite cambiar la contraseña compartida con confirmación y devuelve advertencia', async () => {
    const { service, cuentas } = construir(cuentaCompartida);

    const resultado = await service.cambiarPassword('3000002', '87654321', true);

    expect(cuentas.cambiarPassword).toHaveBeenCalledWith('cuenta-1', '87654321');
    expect(resultado).toMatchObject({
      proveedor_cuenta_id: '3000002',
      cuenta_compartida: true,
      advertencia: expect.stringContaining('todos los Clientes Finales'),
    });
  });

  it('permite cambiar la contraseña de una Cuenta exclusiva sin confirmación', async () => {
    const { service, cuentas } = construir(cuentaExclusiva);

    const resultado = await service.cambiarPassword('3000002', '87654321');

    expect(cuentas.cambiarPassword).toHaveBeenCalledWith('cuenta-1', '87654321');
    expect(resultado).toMatchObject({
      proveedor_cuenta_id: '3000002',
      cuenta_compartida: false,
      advertencia: null,
    });
  });

  it('pide confirmación para cambiar el PIN de una Cuenta compartida', async () => {
    const { service, cuentas } = construir(cuentaCompartida);

    await expect(service.cambiarPin('3000002', '654321')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(cuentas.cambiarPin).not.toHaveBeenCalled();
  });

  it('pide confirmación para cambiar servicios de una Cuenta compartida', async () => {
    const { service, cuentas } = construir(cuentaCompartida);

    await expect(
      service.cambiarServicios('3000002', ['1', '2']),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(cuentas.actualizarPropiedades).not.toHaveBeenCalled();
  });

  it('rechaza una Cuenta inactiva', async () => {
    const { service } = construir({ ...cuentaCompartida, estado: 'cerrada' });

    await expect(
      service.cambiarPassword('3000002', '87654321', true),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza una Cuenta que no existe en la Empresa', async () => {
    const { service } = construir(null);

    await expect(
      service.cambiarPassword('9999999', '87654321', true),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exige confirmación para la baja definitiva del Cliente', async () => {
    const { service } = construir(cuentaCompartida);

    await expect(service.darDeBajaCliente('12345678')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('exige confirmación para la baja definitiva del Dispositivo', async () => {
    const { service } = construir(cuentaCompartida);

    await expect(
      service.darDeBajaDispositivo('3000002', '40009999'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('exige DNI o ID de gestión para buscar un Cliente', async () => {
    const { service } = construir(cuentaCompartida);

    await expect(service.buscarClienteResumen()).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
