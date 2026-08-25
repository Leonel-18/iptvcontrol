import { EstadoCuenta } from '@prisma/client';
import { CuentasProvisioningService } from './cuentas-provisioning.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AuditService } from '../../common/audit/audit.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { ConfiguracionProveedorService } from '../../proveedor/configuracion-proveedor.service';
import { IdentificadoresService } from './identificadores.service';

/**
 * =============================================================================
 * Regresión: `external_customer_id` debe coincidir con el DNI generado
 * =============================================================================
 * Confirmado con la respuesta real de SENSA: el DNI que IPTVControl genera
 * (ej. "30000026") tiene que viajar también como `external_customer_id`, no un
 * identificador propio (como el UUID interno de la Cuenta, que fue el bug
 * detectado). Es el valor que Bruno usa para cruzar la Cuenta de SENSA con
 * IPTVControl a simple vista.
 * =============================================================================
 */
describe('CuentasProvisioningService — crearCuenta', () => {
  const empresaRevendedora = {
    id: 'empresa-1',
    razonSocial: 'ISP de prueba',
    nombreContacto: 'Bruno',
    apellidoContacto: 'Contacto',
    direccion: 'Echeverría 1776',
    telefonoContacto: '2615550000',
  } as any;

  const cuentaReservada = {
    id: 'cuenta-1',
    empresaRevendedoraId: empresaRevendedora.id,
    dniAltaSensa: '30000026',
    usuario: '30000026',
    emailContacto: 'contacto1@isp.com',
    esExclusiva: false,
    servicios: '1',
    limiteDispositivos: 3,
    dispositivosFijosHabilitados: 3,
    dispositivosMovilesHabilitados: 3,
    estado: EstadoCuenta.activa,
  };

  const crearServicio = () => {
    const crearCuentaProveedor = jest.fn().mockResolvedValue({
      proveedorCuentaId: '30000026',
      dni: '30000026',
      email: 'contacto1@isp.com',
      servicios: '1',
      dispositivosFijos: 3,
      dispositivosMoviles: 3,
      activa: true,
    });

    const tx = {
      cuenta: {
        create: jest.fn().mockResolvedValue(cuentaReservada),
        update: jest.fn().mockResolvedValue(cuentaReservada),
      },
    };

    const prisma = {
      transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(tx)),
      operadorPrincipal: {
        findUnique: jest.fn().mockResolvedValue({ maxReintentosDni: 25 }),
      },
    } as unknown as PrismaService;

    const crypto = {
      generarPasswordNumerica: jest.fn().mockReturnValue('12345678'),
      generarPinNumerico: jest.fn().mockReturnValue('123456'),
      encrypt: jest.fn().mockReturnValue('v1:cifrado'),
    } as unknown as CryptoService;

    const proveedor = { crearCuenta: crearCuentaProveedor } as unknown as ProveedorService;

    const configuracion = {
      obtener: jest.fn().mockResolvedValue({
        proveedorId: 'proveedor-1',
        ciudadPorDefecto: 'Mendoza',
        serviciosPorDefecto: '1',
      }),
    } as unknown as ConfiguracionProveedorService;

    const identificadores = {
      siguienteDni: jest.fn().mockResolvedValue('30000026'),
      siguienteEmailCuenta: jest.fn().mockResolvedValue({ email: 'contacto1@isp.com' }),
    } as unknown as IdentificadoresService;

    const audit = { registrarEnTx: jest.fn() } as unknown as AuditService;

    const servicio = new CuentasProvisioningService(
      prisma,
      crypto,
      proveedor,
      configuracion,
      identificadores,
      audit,
    );

    return { servicio, crearCuentaProveedor };
  };

  it('envía referenciaExterna igual al DNI generado, no al UUID de la Cuenta', async () => {
    const { servicio, crearCuentaProveedor } = crearServicio();

    await servicio.crearCuenta({
      empresaRevendedora,
      operadorPrincipalId: 'operador-1',
      esExclusiva: false,
    });

    expect(crearCuentaProveedor).toHaveBeenCalledTimes(1);
    const [, params] = crearCuentaProveedor.mock.calls[0];
    expect(params.referenciaExterna).toBe('30000026');
    expect(params.referenciaExterna).toBe(params.dni);
    // El UUID interno de la Cuenta nunca debe viajar como referencia externa.
    expect(params.referenciaExterna).not.toBe(cuentaReservada.id);
  });

  /**
   * =============================================================================
   * Regresión: los tres contadores de SENSA avanzan siempre en lockstep
   * =============================================================================
   * `auto_provision_count` (genérico, STB) no tiene uso de negocio propio, pero
   * si no viaja con el mismo valor que `auto_provision_count_mobile`/
   * `_stationary`, queda desincronizado apenas se crea o se suma una venta a
   * una Cuenta compartida. Los tres deben ser siempre el mismo número.
   * =============================================================================
   */
  it('una Cuenta compartida nueva arranca con los tres contadores en 1 (no en 3)', async () => {
    const { servicio, crearCuentaProveedor } = crearServicio();

    await servicio.crearCuenta({
      empresaRevendedora,
      operadorPrincipalId: 'operador-1',
      esExclusiva: false,
    });

    const [, params] = crearCuentaProveedor.mock.calls[0];
    expect(params.dispositivosFijos).toBe(1);
    expect(params.dispositivosMoviles).toBe(1);
    expect(params.limiteDispositivos).toBe(1);
  });

  it('una Cuenta exclusiva arranca con los tres contadores en 3', async () => {
    const { servicio, crearCuentaProveedor } = crearServicio();

    await servicio.crearCuenta({
      empresaRevendedora,
      operadorPrincipalId: 'operador-1',
      esExclusiva: true,
    });

    const [, params] = crearCuentaProveedor.mock.calls[0];
    expect(params.dispositivosFijos).toBe(3);
    expect(params.dispositivosMoviles).toBe(3);
    expect(params.limiteDispositivos).toBe(3);
  });
});

describe('CuentasProvisioningService — contadores de venta', () => {
  const cuentaCompartida = {
    id: 'cuenta-1',
    empresaRevendedoraId: 'empresa-1',
    proveedorCuentaId: '30000026',
    esExclusiva: false,
    dispositivosFijosHabilitados: 1,
    dispositivosMovilesHabilitados: 1,
  };

  const crearServicio = (
    dispositivos: { estado: string; clienteFinalId: string | null }[],
    overrides?: Partial<typeof cuentaCompartida>,
  ) => {
    const actualizarCapacidadDispositivos = jest.fn().mockResolvedValue(undefined);
    const proveedor = {
      actualizarCapacidadDispositivos,
    } as unknown as ProveedorService;

    const cuentaUpdate = jest.fn().mockResolvedValue(cuentaCompartida);
    const prisma = {
      db: {
        cuenta: {
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ ...cuentaCompartida, ...overrides, dispositivos }),
          update: cuentaUpdate,
        },
      },
    } as unknown as PrismaService;

    const servicio = new CuentasProvisioningService(
      prisma,
      {} as CryptoService,
      proveedor,
      {} as ConfiguracionProveedorService,
      {} as IdentificadoresService,
      {} as AuditService,
    );

    return { servicio, actualizarCapacidadDispositivos, cuentaUpdate };
  };

  it('al sumar la 2ª venta, sube los tres contadores de 1 a 2 (no sólo fijos/móviles)', async () => {
    const { servicio, actualizarCapacidadDispositivos } = crearServicio([
      { estado: 'activo', clienteFinalId: 'cliente-1' },
    ]);

    await servicio.incrementarCapacidadPorNuevaVenta('cuenta-1', 'operador-1');

    expect(actualizarCapacidadDispositivos).toHaveBeenCalledWith('operador-1', {
      proveedorCuentaId: '30000026',
      limiteDispositivos: 2,
      dispositivosFijos: 2,
      dispositivosMoviles: 2,
    });
  });

  it('al quedarse sin ventas activas, resincroniza los tres contadores hacia abajo (mínimo 1)', async () => {
    // Antes tenía 2 ventas (contadores en 2); la última se dio de baja.
    const { servicio, actualizarCapacidadDispositivos } = crearServicio([], {
      dispositivosFijosHabilitados: 2,
      dispositivosMovilesHabilitados: 2,
    });

    await servicio.sincronizarContadoresVenta('cuenta-1', 'operador-1');

    expect(actualizarCapacidadDispositivos).toHaveBeenCalledWith('operador-1', {
      proveedorCuentaId: '30000026',
      limiteDispositivos: 1,
      dispositivosFijos: 1,
      dispositivosMoviles: 1,
    });
  });

  it('una Cuenta exclusiva nunca toca los contadores de SENSA por ventas', async () => {
    const actualizarCapacidadDispositivos = jest.fn();
    const prisma = {
      db: {
        cuenta: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            ...cuentaCompartida,
            esExclusiva: true,
            dispositivos: [],
          }),
        },
      },
    } as unknown as PrismaService;
    const servicio = new CuentasProvisioningService(
      prisma,
      {} as CryptoService,
      { actualizarCapacidadDispositivos } as unknown as ProveedorService,
      {} as ConfiguracionProveedorService,
      {} as IdentificadoresService,
      {} as AuditService,
    );

    await servicio.incrementarCapacidadPorNuevaVenta('cuenta-1', 'operador-1');
    await servicio.sincronizarContadoresVenta('cuenta-1', 'operador-1');

    expect(actualizarCapacidadDispositivos).not.toHaveBeenCalled();
  });
});
