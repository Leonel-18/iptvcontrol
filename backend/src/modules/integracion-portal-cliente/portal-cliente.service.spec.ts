import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PortalClienteService } from './portal-cliente.service';

describe('PortalClienteService', () => {
  const construir = (opciones: {
    cliente?: Record<string, unknown>;
    cuenta?: Record<string, unknown>;
    perteneceCompartida?: boolean;
  }) => {
    const prisma = {
      db: {
        clienteFinal: {
          findMany: jest.fn().mockResolvedValue(opciones.cliente ? [opciones.cliente] : []),
        },
        cuenta: {
          findUnique: jest.fn().mockResolvedValue(opciones.cuenta ?? null),
        },
        ventaCompartida: {
          findUnique: jest
            .fn()
            .mockResolvedValue(
              opciones.perteneceCompartida === false ? null : { id: 'venta-1' },
            ),
        },
        dispositivo: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    };
    const contexto = { empresaRevendedoraId: 'empresa-1' };
    const cuentas = { cambiarPassword: jest.fn().mockResolvedValue({ id: 'cuenta-1' }) };
    const service = new PortalClienteService(
      prisma as never,
      contexto as never,
      cuentas as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, cuentas, prisma };
  };

  const cliente = { id: 'cliente-1', empresaRevendedoraId: 'empresa-1', estado: 'activo' };

  it('pide confirmación explícita para cambiar la contraseña de una Cuenta compartida', async () => {
    const { service, cuentas } = construir({
      cliente,
      cuenta: {
        id: 'cuenta-1',
        empresaRevendedoraId: 'empresa-1',
        esExclusiva: false,
        clienteFinalExclusivoId: null,
        estado: 'activa',
      },
    });

    await expect(
      service.cambiarPassword('12345678', 'cuenta-1', '12345678'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(cuentas.cambiarPassword).not.toHaveBeenCalled();
  });

  it('permite cambiar la contraseña compartida con confirmación y devuelve advertencia', async () => {
    const { service, cuentas } = construir({
      cliente,
      cuenta: {
        id: 'cuenta-1',
        empresaRevendedoraId: 'empresa-1',
        esExclusiva: false,
        clienteFinalExclusivoId: null,
        estado: 'activa',
      },
    });

    const resultado = await service.cambiarPassword(
      '12345678',
      'cuenta-1',
      '87654321',
      true,
    );

    expect(cuentas.cambiarPassword).toHaveBeenCalledWith('cuenta-1', '87654321');
    expect(resultado).toMatchObject({
      cuenta_compartida: true,
      advertencia: expect.stringContaining('todos los Clientes Finales'),
    });
  });

  it('bloquea una Cuenta compartida si el Cliente no pertenece a ella', async () => {
    const { service, cuentas } = construir({
      cliente,
      cuenta: {
        id: 'cuenta-1',
        empresaRevendedoraId: 'empresa-1',
        esExclusiva: false,
        clienteFinalExclusivoId: null,
        estado: 'activa',
      },
      perteneceCompartida: false,
    });

    await expect(
      service.cambiarPassword('12345678', 'cuenta-1', '12345678', true),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(cuentas.cambiarPassword).not.toHaveBeenCalled();
  });

  it('bloquea escrituras en una Cuenta exclusiva de otro cliente', async () => {
    const { service, cuentas } = construir({
      cliente,
      cuenta: {
        id: 'cuenta-1',
        empresaRevendedoraId: 'empresa-1',
        esExclusiva: true,
        clienteFinalExclusivoId: 'otro-cliente',
        estado: 'activa',
      },
    });

    await expect(
      service.cambiarPassword('12345678', 'cuenta-1', '12345678'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(cuentas.cambiarPassword).not.toHaveBeenCalled();
  });

  it('permite al titular cambiar la contraseña de su Cuenta exclusiva', async () => {
    const { service, cuentas } = construir({
      cliente,
      cuenta: {
        id: 'cuenta-1',
        empresaRevendedoraId: 'empresa-1',
        esExclusiva: true,
        clienteFinalExclusivoId: 'cliente-1',
        estado: 'activa',
      },
    });

    await service.cambiarPassword('12345678', 'cuenta-1', '87654321');
    expect(cuentas.cambiarPassword).toHaveBeenCalledWith('cuenta-1', '87654321');
  });
});
