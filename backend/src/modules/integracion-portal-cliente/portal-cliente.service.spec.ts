import { ForbiddenException } from '@nestjs/common';
import { PortalClienteService } from './portal-cliente.service';

describe('PortalClienteService', () => {
  const construir = (opciones: {
    cliente?: Record<string, unknown>;
    cuenta?: Record<string, unknown>;
  }) => {
    const prisma = {
      db: {
        clienteFinal: {
          findMany: jest.fn().mockResolvedValue(opciones.cliente ? [opciones.cliente] : []),
        },
        cuenta: {
          findUnique: jest.fn().mockResolvedValue(opciones.cuenta ?? null),
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

  it('bloquea escrituras en una Cuenta compartida', async () => {
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
