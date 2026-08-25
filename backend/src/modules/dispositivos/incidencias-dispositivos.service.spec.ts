import { EstadoClienteFinal, EstadoDispositivo, EstadoIncidenciaDispositivo } from '@prisma/client';
import { IncidenciasDispositivosService } from './incidencias-dispositivos.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { AuditService } from '../../common/audit/audit.service';
import { CuentasProvisioningService } from '../cuentas/cuentas-provisioning.service';

/**
 * =============================================================================
 * Caso real: Valentín Alamo (PC ya vinculada como "fijo") + TV detectada como
 * incidencia porque excedió el cupo de 1 fijo de su venta unitaria.
 * =============================================================================
 * Antes del rediseño de capacidad.util, "vincular" dependía de encontrar una
 * `SolicitudVinculacionDispositivo` en estado "ambiguo" — un estado que el
 * nuevo `vincularCandidatos` ya no genera. Este test fija el comportamiento
 * correcto: "vincular" crea el Dispositivo directo para el Cliente Final
 * indicado, sin pasar por esa solicitud.
 * =============================================================================
 */
describe('IncidenciasDispositivosService — resolver', () => {
  const incidenciaPendiente = {
    id: 'incidencia-tv',
    cuentaId: 'cuenta-1',
    empresaRevendedoraId: 'empresa-1',
    proveedorDeviceId: 'sensa-tv-1',
    mac: 'DBBE2D06D713',
    tipoProveedor: 'stationary',
    estado: EstadoIncidenciaDispositivo.pendiente,
    cuenta: { id: 'cuenta-1', esExclusiva: false, proveedorCuentaId: '30000026' },
  };

  const crearServicio = (opciones?: {
    clienteFinal?: Record<string, unknown> | null;
    dispositivosDelClienteEnCuenta?: number;
    dispositivoYaVinculado?: Record<string, unknown> | null;
  }) => {
    const dispositivoCreate = jest.fn().mockResolvedValue({ id: 'dispositivo-tv-nuevo' });
    const incidenciaUpdate = jest.fn().mockResolvedValue(undefined);
    const dispositivoCount = jest
      .fn()
      .mockResolvedValue(opciones?.dispositivosDelClienteEnCuenta ?? 1);
    const dispositivoFindUnique = jest
      .fn()
      .mockResolvedValue(opciones?.dispositivoYaVinculado ?? null);
    const incidenciaUpdateDirecta = jest.fn().mockResolvedValue(undefined);

    const tx = {
      dispositivo: { create: dispositivoCreate },
      incidenciaDispositivoProveedor: { update: incidenciaUpdate },
    };

    const prisma = {
      db: {
        incidenciaDispositivoProveedor: {
          findUnique: jest.fn().mockResolvedValue(incidenciaPendiente),
          update: incidenciaUpdateDirecta,
        },
        clienteFinal: {
          findUnique: jest.fn().mockResolvedValue(
            opciones?.clienteFinal !== undefined
              ? opciones.clienteFinal
              : {
                  id: 'cliente-valentin',
                  empresaRevendedoraId: 'empresa-1',
                  estado: EstadoClienteFinal.activo,
                },
          ),
        },
        dispositivo: { count: dispositivoCount, findUnique: dispositivoFindUnique },
      },
      transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const contexto = { operadorPrincipalId: 'operador-1' } as unknown as RequestContextService;
    const eliminarDispositivo = jest.fn().mockResolvedValue(undefined);
    const proveedor = { eliminarDispositivo } as unknown as ProveedorService;
    const audit = { registrarEnTx: jest.fn() } as unknown as AuditService;
    const incrementarCapacidadPorNuevaVenta = jest.fn().mockResolvedValue(undefined);
    const provisioning = {
      incrementarCapacidadPorNuevaVenta,
    } as unknown as CuentasProvisioningService;

    const servicio = new IncidenciasDispositivosService(
      prisma,
      contexto,
      proveedor,
      audit,
      provisioning,
    );

    return {
      servicio,
      dispositivoCreate,
      incidenciaUpdate,
      incidenciaUpdateDirecta,
      eliminarDispositivo,
      incrementarCapacidadPorNuevaVenta,
      dispositivoCount,
    };
  };

  it('vincula la TV directo al Cliente Final indicado, como Dispositivo "fijo" vinculado', async () => {
    const { servicio, dispositivoCreate, incidenciaUpdate } = crearServicio();

    const resultado = await servicio.resolver('incidencia-tv', 'vincular', 'cliente-valentin');

    expect(dispositivoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cuentaId: 'cuenta-1',
          clienteFinalId: 'cliente-valentin',
          proveedorDeviceId: 'sensa-tv-1',
          tipo: 'fijo',
          tipoProveedor: 'stationary',
          estado: EstadoDispositivo.activo,
        }),
      }),
    );
    expect(incidenciaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: EstadoIncidenciaDispositivo.reconocido }),
      }),
    );
    expect(resultado.resolucion).toBe('vinculado');
    expect(resultado.dispositivo_id).toBe('dispositivo-tv-nuevo');
  });

  it('NO sube el contador de SENSA si el cliente ya tenía otro Dispositivo en la Cuenta', async () => {
    const { servicio, incrementarCapacidadPorNuevaVenta } = crearServicio({
      dispositivosDelClienteEnCuenta: 1,
    });

    await servicio.resolver('incidencia-tv', 'vincular', 'cliente-valentin');

    expect(incrementarCapacidadPorNuevaVenta).not.toHaveBeenCalled();
  });

  it('sube el contador de SENSA si el cliente no tenía ningún Dispositivo antes (venta nueva)', async () => {
    const { servicio, incrementarCapacidadPorNuevaVenta } = crearServicio({
      dispositivosDelClienteEnCuenta: 0,
    });

    await servicio.resolver('incidencia-tv', 'vincular', 'cliente-otro');

    expect(incrementarCapacidadPorNuevaVenta).toHaveBeenCalledWith('cuenta-1', 'operador-1');
  });

  it('exige indicar el Cliente Final al vincular', async () => {
    const { servicio } = crearServicio();

    await expect(servicio.resolver('incidencia-tv', 'vincular')).rejects.toThrow(
      'Falta indicar a qué Cliente Final',
    );
  });

  it('rechaza un Cliente Final de otra Empresa Revendedora', async () => {
    const { servicio } = crearServicio({
      clienteFinal: { id: 'cliente-otro', empresaRevendedoraId: 'empresa-2', estado: 'activo' },
    });

    await expect(servicio.resolver('incidencia-tv', 'vincular', 'cliente-otro')).rejects.toThrow(
      'no pertenece a esta Empresa Revendedora',
    );
  });

  it('elimina el Dispositivo desconocido en el Proveedor sin pedir Cliente Final', async () => {
    const { servicio, eliminarDispositivo, incidenciaUpdate } = crearServicio();

    const resultado = await servicio.resolver('incidencia-tv', 'eliminar');

    expect(eliminarDispositivo).toHaveBeenCalledWith('operador-1', 'sensa-tv-1');
    expect(incidenciaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: EstadoIncidenciaDispositivo.resuelto }),
      }),
    );
    expect(resultado.resolucion).toBe('eliminado');
  });

  /**
   * =============================================================================
   * Caso real: Martín Palermo (25/08/2026)
   * =============================================================================
   * El sondeo normal ya había vinculado el equipo cuando alguien apretó
   * "Vincular éste" sobre la incidencia huérfana. Antes esto explotaba contra
   * la restricción de unicidad (`cuentaId` + `proveedorDeviceId`); ahora se
   * detecta antes de intentar el `create` y se resuelve con criterio.
   * =============================================================================
   */
  it('si el equipo ya está vinculado al mismo cliente, cierra la incidencia sin duplicar el Dispositivo', async () => {
    const { servicio, dispositivoCreate, incidenciaUpdateDirecta } = crearServicio({
      dispositivoYaVinculado: {
        id: 'dispositivo-existente',
        clienteFinalId: 'cliente-valentin',
      },
    });

    const resultado = await servicio.resolver('incidencia-tv', 'vincular', 'cliente-valentin');

    expect(dispositivoCreate).not.toHaveBeenCalled();
    expect(incidenciaUpdateDirecta).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'incidencia-tv' },
        data: expect.objectContaining({ estado: EstadoIncidenciaDispositivo.reconocido }),
      }),
    );
    expect(resultado.resolucion).toBe('vinculado');
    expect(resultado.dispositivo_id).toBe('dispositivo-existente');
  });

  it('si el equipo ya está vinculado a OTRO cliente, avisa que use "Corregir vinculación"', async () => {
    const { servicio, dispositivoCreate } = crearServicio({
      dispositivoYaVinculado: {
        id: 'dispositivo-existente',
        clienteFinalId: 'cliente-otro-distinto',
      },
    });

    await expect(
      servicio.resolver('incidencia-tv', 'vincular', 'cliente-valentin'),
    ).rejects.toThrow('Corregir vinculación');
    expect(dispositivoCreate).not.toHaveBeenCalled();
  });
});
