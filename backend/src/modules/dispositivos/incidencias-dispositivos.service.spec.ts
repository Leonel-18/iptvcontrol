import { EstadoClienteFinal, EstadoDispositivo, EstadoIncidenciaDispositivo } from '@prisma/client';
import { IncidenciasDispositivosService } from './incidencias-dispositivos.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { ColaProveedorService } from '../../queues/cola-proveedor.service';
import { AuditService } from '../../common/audit/audit.service';
import { CuentasProvisioningService } from '../cuentas/cuentas-provisioning.service';

/**
 * =============================================================================
 * Caso real: Valentín Alamo (PC ya vinculada como "fijo") + TV detectada como
 * incidencia porque excedió el cupo fijo de su venta compartida.
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
    ocupadosCategoria?: number;
    dispositivoYaVinculado?: Record<string, unknown> | null;
    dispositivoVinculadoDuranteBloqueo?: Record<string, unknown> | null;
    cuenta?: Record<string, unknown>;
  }) => {
    const incidencia = {
      ...incidenciaPendiente,
      cuenta: opciones?.cuenta ?? incidenciaPendiente.cuenta,
    };
    const dispositivoCreate = jest.fn().mockResolvedValue({ id: 'dispositivo-tv-nuevo' });
    const incidenciaUpdate = jest.fn().mockResolvedValue(undefined);
    const dispositivoCount = jest.fn().mockResolvedValue(opciones?.ocupadosCategoria ?? 0);
    const dispositivoFindUnique = jest
      .fn()
      .mockResolvedValue(opciones?.dispositivoYaVinculado ?? null);
    const incidenciaUpdateDirecta = jest.fn().mockResolvedValue(undefined);
    const cuentaUpdate = jest.fn().mockResolvedValue({ count: 1 });
    const dispositivoFindUniqueEnTx = jest
      .fn()
      .mockResolvedValue(opciones?.dispositivoVinculadoDuranteBloqueo ?? null);

    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      dispositivo: {
        create: dispositivoCreate,
        count: dispositivoCount,
        findUnique: dispositivoFindUniqueEnTx,
      },
      ventaCompartida: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ cuposPorCategoria: 1 }),
      },
      incidenciaDispositivoProveedor: { update: incidenciaUpdate },
      cuenta: { updateMany: cuentaUpdate },
    };

    const prisma = {
      db: {
        incidenciaDispositivoProveedor: {
          findUnique: jest.fn().mockResolvedValue(incidencia),
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
        ventaCompartida: {
          findUnique: jest
            .fn()
            .mockResolvedValue(
              (opciones?.dispositivosDelClienteEnCuenta ?? 1) > 0 ? { cuposPorCategoria: 1 } : null,
            ),
        },
      },
      transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const contexto = { operadorPrincipalId: 'operador-1' } as unknown as RequestContextService;
    const eliminarDispositivo = jest.fn().mockResolvedValue(undefined);
    const proveedor = { eliminarDispositivo } as unknown as ProveedorService;
    const audit = { registrarEnTx: jest.fn() } as unknown as AuditService;
    const reservarCapacidadPorNuevaVenta = jest.fn().mockResolvedValue(true);
    const liberarCapacidadDeVenta = jest.fn().mockResolvedValue(undefined);
    const provisioning = {
      reservarCapacidadPorNuevaVenta,
      liberarCapacidadDeVenta,
    } as unknown as CuentasProvisioningService;
    const cola = {
      encolarSincronizacionContadoresVenta: jest.fn().mockResolvedValue(undefined),
    } as unknown as ColaProveedorService;

    const servicio = new IncidenciasDispositivosService(
      prisma,
      contexto,
      proveedor,
      audit,
      provisioning,
      cola,
    );

    return {
      servicio,
      dispositivoCreate,
      incidenciaUpdate,
      incidenciaUpdateDirecta,
      eliminarDispositivo,
      reservarCapacidadPorNuevaVenta,
      dispositivoCount,
      cuentaUpdate,
      executeRaw: tx.$executeRaw,
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
    const { servicio, reservarCapacidadPorNuevaVenta } = crearServicio({
      dispositivosDelClienteEnCuenta: 1,
    });

    await servicio.resolver('incidencia-tv', 'vincular', 'cliente-valentin');

    expect(reservarCapacidadPorNuevaVenta).not.toHaveBeenCalled();
  });

  it('no permite vincular un fijo que exceda el cupo de la venta', async () => {
    const { servicio } = crearServicio({
      dispositivosDelClienteEnCuenta: 1,
      ocupadosCategoria: 1,
    });

    await expect(
      servicio.resolver('incidencia-tv', 'vincular', 'cliente-valentin'),
    ).rejects.toThrow('ya completó sus cupos para esta categoría');
  });

  it('sube el contador de SENSA si el cliente no tenía ningún Dispositivo antes (venta nueva)', async () => {
    const { servicio, reservarCapacidadPorNuevaVenta } = crearServicio({
      dispositivosDelClienteEnCuenta: 0,
    });

    await servicio.resolver('incidencia-tv', 'vincular', 'cliente-otro');

    expect(reservarCapacidadPorNuevaVenta).toHaveBeenCalledWith({
      cuentaId: 'cuenta-1',
      clienteFinalId: 'cliente-otro',
      empresaRevendedoraId: 'empresa-1',
      cuposPorCategoria: 1,
      operadorPrincipalId: 'operador-1',
      actualizarProveedor: true,
    });
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

  it('asigna el propietario de una Cuenta exclusiva vacía al vincular su primer equipo', async () => {
    const { servicio, cuentaUpdate, executeRaw } = crearServicio({
      cuenta: {
        id: 'cuenta-1',
        esExclusiva: true,
        clienteFinalExclusivoId: null,
        proveedorCuentaId: '30000026',
      },
    });

    await servicio.resolver('incidencia-tv', 'vincular', 'cliente-valentin');

    expect(executeRaw).toHaveBeenCalled();
    expect(cuentaUpdate).toHaveBeenCalledWith({
      where: {
        id: 'cuenta-1',
        OR: [{ clienteFinalExclusivoId: null }, { clienteFinalExclusivoId: 'cliente-valentin' }],
      },
      data: { clienteFinalExclusivoId: 'cliente-valentin' },
    });
  });

  it('rechaza vincular a otro cliente una Cuenta exclusiva que ya tiene propietario', async () => {
    const { servicio, dispositivoCreate } = crearServicio({
      cuenta: {
        id: 'cuenta-1',
        esExclusiva: true,
        clienteFinalExclusivoId: 'cliente-titular',
        proveedorCuentaId: '30000026',
      },
    });

    await expect(
      servicio.resolver('incidencia-tv', 'vincular', 'cliente-valentin'),
    ).rejects.toThrow('pertenece a otro Cliente Final');
    expect(dispositivoCreate).not.toHaveBeenCalled();
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

  it('vuelve a verificar el duplicado dentro del lock antes de crear', async () => {
    const { servicio, dispositivoCreate } = crearServicio({
      dispositivoVinculadoDuranteBloqueo: {
        id: 'dispositivo-creado-en-paralelo',
        clienteFinalId: 'cliente-valentin',
      },
    });

    const resultado = await servicio.resolver('incidencia-tv', 'vincular', 'cliente-valentin');

    expect(dispositivoCreate).not.toHaveBeenCalled();
    expect(resultado.dispositivo_id).toBe('dispositivo-creado-en-paralelo');
  });
});
