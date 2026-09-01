import { EstadoIncidenciaDispositivo } from '@prisma/client';
import { InventarioProveedorService } from './inventario-proveedor.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { AuditService } from '../../common/audit/audit.service';

/**
 * =============================================================================
 * InventarioProveedorService — detección de Dispositivos no autorizados
 * =============================================================================
 * Motivo del test: SENSA no tiene webhooks. Este servicio es la única forma de
 * enterarse de un Dispositivo que se auto-provisionó por el reproductor web
 * fuera de una venta (ej. credenciales compartidas reutilizadas). La regla es
 * estricta: nunca se elimina solo, siempre queda como incidencia pendiente.
 * =============================================================================
 */
describe('InventarioProveedorService — sincronizar', () => {
  const cuentaBase = {
    id: 'cuenta-1',
    empresaRevendedoraId: 'empresa-1',
    proveedorCuentaId: '30000001',
    limiteDispositivos: 3,
    dispositivos: [
      {
        id: 'dispositivo-1',
        proveedorDeviceId: 'sensa-vinculado',
        clienteFinal: { id: 'cliente-1', numeroCliente: 5, nombre: 'Ana', apellido: 'Pérez' },
      },
    ],
    solicitudesVinculacion: [],
  };

  const crearServicio = (
    esOperador: boolean,
    overrides?: {
      incidenciaExistente?: Record<string, unknown> | null;
      cuenta?: Record<string, unknown>;
      pendientesConDueno?: Record<string, unknown>[];
      inventario?: Record<string, unknown>[];
    },
  ) => {
    const findUniqueCuenta = jest.fn().mockResolvedValue(overrides?.cuenta ?? cuentaBase);
    const findUniqueIncidencia = jest
      .fn()
      .mockResolvedValue(overrides?.incidenciaExistente ?? null);
    const updateIncidencia = jest.fn().mockImplementation(({ data }) => ({
      id: 'incidencia-1',
      estado: data.estado ?? EstadoIncidenciaDispositivo.pendiente,
    }));
    const createIncidencia = jest
      .fn()
      .mockResolvedValue({ id: 'incidencia-nueva', estado: EstadoIncidenciaDispositivo.pendiente });
    const findManyIncidencias = jest.fn().mockResolvedValue(overrides?.pendientesConDueno ?? []);

    const tx = {
      incidenciaDispositivoProveedor: {
        findUnique: findUniqueIncidencia,
        update: updateIncidencia,
        create: createIncidencia,
      },
    };

    const prisma = {
      db: {
        cuenta: { findUnique: findUniqueCuenta },
        incidenciaDispositivoProveedor: { findMany: findManyIncidencias },
      },
      transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const contexto = {
      esOperador,
      operadorPrincipalId: 'operador-1',
    } as unknown as RequestContextService;

    const listarDispositivos = jest.fn().mockResolvedValue(
      overrides?.inventario ?? [
        { proveedorDeviceId: 'sensa-vinculado', mac: '030000000001', tipo: 'phone', activo: true },
        {
          proveedorDeviceId: 'sensa-desconocido',
          mac: '0123456789012345678901234567890123456789',
          tipo: 'cloud_client',
          activo: true,
          nombre: 'Chrome',
        },
      ],
    );
    const proveedor = { listarDispositivos } as unknown as ProveedorService;
    const audit = { registrarEnTx: jest.fn() } as unknown as AuditService;

    const servicio = new InventarioProveedorService(prisma, contexto, proveedor, audit);
    return {
      servicio,
      createIncidencia,
      updateIncidencia,
      findUniqueIncidencia,
      findManyIncidencias,
    };
  };

  it('clasifica vinculado y desconocido, y crea la incidencia del desconocido', async () => {
    const { servicio, createIncidencia } = crearServicio(false);

    const resultado = await servicio.sincronizar('cuenta-1');

    expect(resultado.dispositivos).toHaveLength(2);
    const vinculado = resultado.dispositivos.find(
      (d) => d.proveedor_device_id === 'sensa-vinculado',
    );
    const desconocido = resultado.dispositivos.find(
      (d) => d.proveedor_device_id === 'sensa-desconocido',
    );

    expect(vinculado?.clasificacion).toBe('vinculado');
    expect(vinculado?.cliente_final?.nombre).toBe('Ana Pérez');
    expect(desconocido?.clasificacion).toBe('desconocido');
    expect(desconocido?.incidencia_id).toBe('incidencia-nueva');
    expect(createIncidencia).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mac: '0123456789012345678901234567890123456789',
        }),
      }),
    );
    expect(createIncidencia).toHaveBeenCalledTimes(1);
  });

  it('el Operador Principal no recibe nombre de cliente ni MAC (regla 4.2)', async () => {
    const { servicio } = crearServicio(true);

    const resultado = await servicio.sincronizar('cuenta-1');
    const vinculado = resultado.dispositivos.find(
      (d) => d.proveedor_device_id === 'sensa-vinculado',
    );
    const desconocido = resultado.dispositivos.find(
      (d) => d.proveedor_device_id === 'sensa-desconocido',
    );

    expect(vinculado?.cliente_final).toBeNull();
    expect(vinculado?.mac).toBeUndefined();
    expect(desconocido?.mac).toBeUndefined();
    expect(desconocido?.nombre).toBeUndefined();
  });

  it('nunca elimina un Dispositivo desconocido: sólo lo deja pendiente de revisión', async () => {
    const { servicio, createIncidencia } = crearServicio(false);
    await servicio.sincronizar('cuenta-1');
    // Ningún llamado a eliminarDispositivo existe en este servicio: la única
    // vía de baja es el resolver de incidencias, invocado explícitamente.
    expect(createIncidencia).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ proveedorDeviceId: 'sensa-desconocido' }),
      }),
    );
  });

  it('reabre una incidencia ya resuelta si el Dispositivo reaparece', async () => {
    const { servicio, updateIncidencia } = crearServicio(false, {
      incidenciaExistente: { id: 'incidencia-vieja', estado: EstadoIncidenciaDispositivo.resuelto },
    });

    const resultado = await servicio.sincronizar('cuenta-1');
    const desconocido = resultado.dispositivos.find(
      (d) => d.proveedor_device_id === 'sensa-desconocido',
    );

    expect(updateIncidencia).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: EstadoIncidenciaDispositivo.pendiente }),
      }),
    );
    expect(desconocido?.incidencia_id).toBe('incidencia-1');
  });

  /**
   * =============================================================================
   * Caso real: Martín Palermo (25/08/2026)
   * =============================================================================
   * El sondeo normal (cada 30 s) vinculó el equipo 9 segundos después de que
   * esta misma consulta lo hubiera marcado como "desconocido". La incidencia
   * quedó huérfana apuntando a un Dispositivo que ya tenía dueño, y "Vincular
   * éste" explotaba contra la restricción de unicidad de la base.
   * =============================================================================
   */
  it('cierra sola una incidencia pendiente cuyo Dispositivo ya está vinculado', async () => {
    const { servicio, findManyIncidencias, updateIncidencia } = crearServicio(false, {
      pendientesConDueno: [
        { id: 'incidencia-huerfana', proveedorDeviceId: 'sensa-vinculado', cuentaId: 'cuenta-1' },
      ],
    });

    await servicio.sincronizar('cuenta-1');

    expect(findManyIncidencias).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cuentaId: 'cuenta-1',
          estado: EstadoIncidenciaDispositivo.pendiente,
          proveedorDeviceId: { in: ['sensa-vinculado'] },
        }),
      }),
    );
    expect(updateIncidencia).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'incidencia-huerfana' },
        data: expect.objectContaining({ estado: EstadoIncidenciaDispositivo.reconocido }),
      }),
    );
  });

  it('con una ventana de vinculación abierta, registra la incidencia para permitir resolverla', async () => {
    const { servicio, createIncidencia } = crearServicio(false, {
      cuenta: { ...cuentaBase, solicitudesVinculacion: [{ id: 'solicitud-1' }] },
    });

    const resultado = await servicio.sincronizar('cuenta-1');
    const desconocido = resultado.dispositivos.find(
      (d) => d.proveedor_device_id === 'sensa-desconocido',
    );

    expect(createIncidencia).toHaveBeenCalledTimes(1);
    expect(desconocido?.clasificacion).toBe('desconocido');
    expect(desconocido?.incidencia_id).toBe('incidencia-nueva');
    expect(desconocido?.ventana_activa).toBe(true);
  });

  it('registra seis Dispositivos desconocidos con identificadores largos sin fallar', async () => {
    const inventario = Array.from({ length: 6 }, (_, indice) => ({
      proveedorDeviceId: `sensa-desconocido-${indice + 1}`,
      mac: `${indice}`.repeat(40),
      tipo: indice % 2 === 0 ? 'stationary' : 'cloud_client',
      activo: true,
    }));
    const { servicio, createIncidencia } = crearServicio(false, { inventario });

    const resultado = await servicio.sincronizar('cuenta-1');

    expect(resultado.dispositivos).toHaveLength(6);
    expect(resultado.dispositivos.every((item) => item.clasificacion === 'desconocido')).toBe(true);
    expect(createIncidencia).toHaveBeenCalledTimes(6);
  });
});
