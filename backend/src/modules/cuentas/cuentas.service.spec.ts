import { EstadoCuenta, EstadoDispositivo } from '@prisma/client';
import { CuentasService } from './cuentas.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { AuditService } from '../../common/audit/audit.service';

/**
 * =============================================================================
 * Cierre de Cuenta (caso real: Cuenta 30000043 creada por error, 24/08/2026)
 * =============================================================================
 * Feature nueva a pedido de Bruno: limpiar Cuentas creadas por error o
 * abandonadas, sin dejar huérfanos en SENSA ni permitir cerrar una Cuenta que
 * en realidad todavía está en uso.
 * =============================================================================
 */
describe('CuentasService — cerrar', () => {
  const crearServicio = (cuenta: Record<string, unknown> | null) => {
    const cuentaDelete = jest.fn().mockResolvedValue(undefined);
    const cuentaUpdate = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      db: {
        cuenta: {
          findUnique: jest.fn().mockResolvedValue(cuenta),
          delete: cuentaDelete,
          update: cuentaUpdate,
        },
      },
    } as unknown as PrismaService;

    const cerrarCuentaProveedor = jest.fn().mockResolvedValue(undefined);
    const proveedor = { cerrarCuenta: cerrarCuentaProveedor } as unknown as ProveedorService;
    const audit = { registrar: jest.fn() } as unknown as AuditService;
    const contexto = { operadorPrincipalId: 'operador-1' } as unknown as RequestContextService;

    const servicio = new CuentasService(prisma, {} as CryptoService, contexto, proveedor, audit);
    return { servicio, cuentaDelete, cuentaUpdate, cerrarCuentaProveedor, audit };
  };

  it('rechaza cerrar una Cuenta con Dispositivos activos', async () => {
    const { servicio } = crearServicio({
      id: 'cuenta-1',
      estado: EstadoCuenta.activa,
      proveedorCuentaId: '30000043',
      empresaRevendedoraId: 'empresa-1',
      dispositivos: [{ estado: EstadoDispositivo.activo }],
    });

    await expect(servicio.cerrar('cuenta-1')).rejects.toThrow(
      'No se puede cerrar una Cuenta con Dispositivos activos',
    );
  });

  it('rechaza cerrar una Cuenta con Dispositivos bloqueados por suspensión', async () => {
    const { servicio } = crearServicio({
      id: 'cuenta-1',
      estado: EstadoCuenta.activa,
      proveedorCuentaId: '30000043',
      empresaRevendedoraId: 'empresa-1',
      dispositivos: [{ estado: EstadoDispositivo.bloqueado_por_suspension }],
    });

    await expect(servicio.cerrar('cuenta-1')).rejects.toThrow(
      'No se puede cerrar una Cuenta con Dispositivos activos',
    );
  });

  it('rechaza cerrar una Cuenta ya cerrada', async () => {
    const { servicio } = crearServicio({
      id: 'cuenta-1',
      estado: EstadoCuenta.cerrada,
      proveedorCuentaId: '30000043',
      empresaRevendedoraId: 'empresa-1',
      dispositivos: [],
    });

    await expect(servicio.cerrar('cuenta-1')).rejects.toThrow('ya está cerrada');
  });

  it('cierra en SENSA y marca la Cuenta como cerrada localmente (Dispositivos disponibles no bloquean)', async () => {
    const { servicio, cerrarCuentaProveedor, cuentaUpdate, audit } = crearServicio({
      id: 'cuenta-1',
      estado: EstadoCuenta.activa,
      proveedorCuentaId: '30000043',
      empresaRevendedoraId: 'empresa-1',
      dispositivos: [{ estado: EstadoDispositivo.disponible }],
    });

    const resultado = await servicio.cerrar('cuenta-1');

    expect(cerrarCuentaProveedor).toHaveBeenCalledWith('operador-1', '30000043');
    expect(cuentaUpdate).toHaveBeenCalledWith({
      where: { id: 'cuenta-1' },
      data: { estado: EstadoCuenta.cerrada },
    });
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        detalle: expect.objectContaining({ proveedor_cuenta_id: '30000043' }),
      }),
    );
    expect(resultado).toEqual({ id: 'cuenta-1', estado: EstadoCuenta.cerrada });
  });

  it('si la Cuenta nunca se confirmó en el Proveedor, sólo borra la reserva local (no llama a SENSA)', async () => {
    const { servicio, cerrarCuentaProveedor, cuentaDelete } = crearServicio({
      id: 'cuenta-1',
      estado: EstadoCuenta.activa,
      proveedorCuentaId: null,
      empresaRevendedoraId: 'empresa-1',
      dispositivos: [],
    });

    const resultado = await servicio.cerrar('cuenta-1');

    expect(cerrarCuentaProveedor).not.toHaveBeenCalled();
    expect(cuentaDelete).toHaveBeenCalledWith({ where: { id: 'cuenta-1' } });
    expect(resultado).toEqual({ id: 'cuenta-1', estado: EstadoCuenta.cerrada });
  });

  it('lanza NotFound si la Cuenta no existe', async () => {
    const { servicio } = crearServicio(null);

    await expect(servicio.cerrar('cuenta-inexistente')).rejects.toThrow(
      'La cuenta no existe o no está disponible.',
    );
  });
});
