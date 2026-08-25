import {
  AccionAuditoria,
  EstadoClienteFinal,
  EstadoDispositivo,
  EstadoVinculacionDispositivo,
  TipoAltaClienteFinal,
} from '@prisma/client';
import { DispositivosService } from './dispositivos.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { CuentasProvisioningService } from '../cuentas/cuentas-provisioning.service';
import { ColaProveedorService } from '../../queues/cola-proveedor.service';

/**
 * =============================================================================
 * corregirVinculacion — caso "Pepito / Marcelo"
 * =============================================================================
 * Cuenta compartida: mientras la ventana de vinculación de Marcelo está
 * abierta, Pepito (otro Cliente Final de la misma Cuenta) prueba sus
 * credenciales en un segundo equipo, que queda vinculado a Marcelo por error.
 * SENSA no identifica de quién es cada inicio de sesión, así que la corrección
 * es siempre una decisión manual de la Empresa Revendedora.
 * =============================================================================
 */
describe('DispositivosService — corregirVinculacion', () => {
  const cuenta = {
    id: 'cuenta-1',
    proveedorCuentaId: '30000001',
    empresaRevendedoraId: 'empresa-1',
    esExclusiva: false,
  };

  const dispositivoVinculado = {
    id: 'dispositivo-marcelo',
    cuentaId: cuenta.id,
    empresaRevendedoraId: 'empresa-1',
    clienteFinalId: 'cliente-marcelo',
    proveedorDeviceId: 'sensa-999',
    estado: EstadoDispositivo.activo,
    estadoVinculacion: EstadoVinculacionDispositivo.vinculado,
    cuenta,
  };

  const crearServicio = () => {
    const tx = {
      solicitudVinculacionDispositivo: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'solicitud-nueva' }),
      },
      dispositivo: {
        update: jest.fn().mockImplementation(({ where, data }) => ({
          ...dispositivoVinculado,
          id: where.id,
          ...data,
        })),
      },
    };

    const prisma = {
      db: {
        dispositivo: {
          findUnique: jest.fn().mockResolvedValue(dispositivoVinculado),
          create: jest.fn().mockResolvedValue({
            id: 'dispositivo-marcelo-nuevo',
            cuentaId: cuenta.id,
            empresaRevendedoraId: 'empresa-1',
            clienteFinalId: 'cliente-marcelo',
            estado: EstadoDispositivo.activo,
            estadoVinculacion: EstadoVinculacionDispositivo.pendiente,
          }),
        },
        clienteFinal: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'cliente-pepito',
            empresaRevendedoraId: 'empresa-1',
            estado: EstadoClienteFinal.activo,
          }),
        },
      },
      transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const eliminarDispositivo = jest.fn().mockResolvedValue(undefined);
    const listarDispositivos = jest.fn().mockResolvedValue([]);
    const proveedor = {
      eliminarDispositivo,
      listarDispositivos,
    } as unknown as ProveedorService;

    const audit = { registrar: jest.fn(), registrarEnTx: jest.fn() } as unknown as AuditService;
    const contexto = { operadorPrincipalId: 'operador-1' } as unknown as RequestContextService;
    const cola = { encolarSondeoVinculacion: jest.fn() } as unknown as ColaProveedorService;

    const servicio = new DispositivosService(
      prisma,
      audit,
      contexto,
      proveedor,
      {} as CuentasProvisioningService,
      cola,
    );

    return { servicio, prisma, proveedor, audit, cola, tx, eliminarDispositivo };
  };

  it('rechaza corregir un Dispositivo que no está vinculado', async () => {
    const { servicio, prisma } = crearServicio();
    (prisma.db.dispositivo.findUnique as jest.Mock).mockResolvedValueOnce({
      ...dispositivoVinculado,
      estadoVinculacion: EstadoVinculacionDispositivo.observando,
    });

    await expect(
      servicio.corregirVinculacion('dispositivo-marcelo', 'operador-1', { accion: 'eliminar' }),
    ).rejects.toThrow('Sólo se puede corregir un Dispositivo activo y ya vinculado');
  });

  describe('accion "eliminar"', () => {
    it('elimina el equipo en el Proveedor y reabre la ventana para el mismo cliente', async () => {
      const { servicio, eliminarDispositivo, cola, tx } = crearServicio();

      const resultado = await servicio.corregirVinculacion('dispositivo-marcelo', 'operador-1', {
        accion: 'eliminar',
      });

      expect(eliminarDispositivo).toHaveBeenCalledWith('operador-1', 'sensa-999');
      expect(resultado.clienteFinalAfectadoId).toBe('cliente-marcelo');
      // Se reutiliza la MISMA fila de Marcelo, reseteada.
      expect(tx.dispositivo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dispositivo-marcelo' },
          data: expect.objectContaining({
            proveedorDeviceId: null,
            estadoVinculacion: EstadoVinculacionDispositivo.observando,
          }),
        }),
      );
      expect(cola.encolarSondeoVinculacion).toHaveBeenCalledWith(
        expect.objectContaining({
          solicitudId: 'solicitud-nueva',
          operadorPrincipalId: 'operador-1',
        }),
      );
    });
  });

  describe('accion "reasignar"', () => {
    it('exige indicar el cliente destino', async () => {
      const { servicio } = crearServicio();
      await expect(
        servicio.corregirVinculacion('dispositivo-marcelo', 'operador-1', { accion: 'reasignar' }),
      ).rejects.toThrow('Falta indicar a qué Cliente Final');
    });

    it('rechaza reasignar al mismo cliente que ya lo tiene', async () => {
      const { servicio } = crearServicio();
      await expect(
        servicio.corregirVinculacion('dispositivo-marcelo', 'operador-1', {
          accion: 'reasignar',
          clienteFinalDestinoId: 'cliente-marcelo',
        }),
      ).rejects.toThrow('Elija un Cliente Final distinto');
    });

    it('rechaza un cliente destino de otra Empresa Revendedora', async () => {
      const { servicio, prisma } = crearServicio();
      (prisma.db.clienteFinal.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'cliente-otro',
        empresaRevendedoraId: 'empresa-2',
        estado: EstadoClienteFinal.activo,
      });

      await expect(
        servicio.corregirVinculacion('dispositivo-marcelo', 'operador-1', {
          accion: 'reasignar',
          clienteFinalDestinoId: 'cliente-otro',
        }),
      ).rejects.toThrow('no pertenece a esta Empresa Revendedora');
    });

    it('transfiere el Dispositivo al cliente real y le abre una ventana nueva al afectado', async () => {
      const { servicio, prisma, tx, cola } = crearServicio();

      const resultado = await servicio.corregirVinculacion('dispositivo-marcelo', 'operador-1', {
        accion: 'reasignar',
        clienteFinalDestinoId: 'cliente-pepito',
      });

      // El Dispositivo físico (con su proveedor_device_id real) pasa a Pepito.
      expect(tx.dispositivo.update).toHaveBeenCalledWith({
        where: { id: 'dispositivo-marcelo' },
        data: { clienteFinalId: 'cliente-pepito' },
      });
      // Marcelo recibe una fila nueva, vacía, en la misma Cuenta.
      expect(prisma.db.dispositivo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cuentaId: 'cuenta-1',
            clienteFinalId: 'cliente-marcelo',
            estadoVinculacion: EstadoVinculacionDispositivo.pendiente,
          }),
        }),
      );
      expect(resultado.clienteFinalAfectadoId).toBe('cliente-marcelo');
      expect(cola.encolarSondeoVinculacion).toHaveBeenCalledWith(
        expect.objectContaining({ solicitudId: 'solicitud-nueva' }),
      );
    });
  });
});

/**
 * =============================================================================
 * Caso real: Usuario 131 (24/08/2026)
 * =============================================================================
 * Cuenta exclusiva, sin ningún Dispositivo detectado dentro de la ventana de
 * 10 minutos. Al vencer, el Dispositivo vuelve a "disponible" — pero antes se
 * le borraba también el `cliente_final_id`, y el sistema "olvidaba" que la
 * Cuenta ya tenía dueño. El próximo alta terminaba creando una Cuenta nueva
 * (compartida, con servicio básico) en vez de reutilizar la existente.
 * =============================================================================
 */
describe('DispositivosService — liberar (preservación del vínculo en Cuentas exclusivas)', () => {
  const dispositivoExclusivo = {
    id: 'dispositivo-1',
    cuentaId: 'cuenta-exclusiva-1',
    empresaRevendedoraId: 'empresa-1',
    clienteFinalId: 'cliente-usuario-131',
    proveedorDeviceId: null,
    cuenta: { id: 'cuenta-exclusiva-1', esExclusiva: true },
  };

  const crearServicio = (dispositivo = dispositivoExclusivo) => {
    const dispositivoUpdate = jest.fn().mockImplementation(({ data }) => ({
      ...dispositivo,
      ...data,
    }));
    const tx = {
      solicitudVinculacionDispositivo: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dispositivo: { update: dispositivoUpdate },
    };
    const prisma = {
      db: { dispositivo: { findUnique: jest.fn().mockResolvedValue(dispositivo) } },
      transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const proveedor = { eliminarDispositivo: jest.fn() } as unknown as ProveedorService;
    const audit = { registrarEnTx: jest.fn() } as unknown as AuditService;
    const cola = {} as unknown as ColaProveedorService;
    const provisioning = {
      sincronizarContadoresVenta: jest.fn().mockResolvedValue(undefined),
    } as unknown as CuentasProvisioningService;

    const servicio = new DispositivosService(
      prisma,
      audit,
      {} as RequestContextService,
      proveedor,
      provisioning,
      cola,
    );
    return { servicio, dispositivoUpdate };
  };

  it('preserva el Cliente Final cuando se da de baja UN Dispositivo suyo (Cuenta exclusiva)', async () => {
    const { servicio, dispositivoUpdate } = crearServicio();

    await servicio.liberar(
      'dispositivo-1',
      'disponible',
      'operador-1',
      AccionAuditoria.baja_dispositivo,
    );

    expect(dispositivoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'disponible',
          clienteFinalId: 'cliente-usuario-131',
        }),
      }),
    );
  });

  it('borra el Cliente Final cuando es baja del cliente completo, aunque sea exclusiva', async () => {
    const { servicio, dispositivoUpdate } = crearServicio();

    await servicio.liberar(
      'dispositivo-1',
      'disponible',
      'operador-1',
      AccionAuditoria.baja_cliente,
    );

    expect(dispositivoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clienteFinalId: null }) }),
    );
  });

  it('borra el Cliente Final en una Cuenta compartida (el cupo queda libre para otra venta)', async () => {
    const { servicio, dispositivoUpdate } = crearServicio({
      ...dispositivoExclusivo,
      cuenta: { id: 'cuenta-compartida-1', esExclusiva: false },
    });

    await servicio.liberar(
      'dispositivo-1',
      'disponible',
      'operador-1',
      AccionAuditoria.baja_dispositivo,
    );

    expect(dispositivoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clienteFinalId: null }) }),
    );
  });
});

describe('DispositivosService — altaAdicional reutiliza la Cuenta exclusiva existente', () => {
  const clienteExclusivo = {
    id: 'cliente-usuario-131',
    estado: EstadoClienteFinal.activo,
    tipoAlta: TipoAltaClienteFinal.cuenta_exclusiva,
    dispositivos: [
      {
        id: 'dispositivo-viejo',
        estado: EstadoDispositivo.disponible,
        cuenta: {
          id: 'cuenta-exclusiva-1',
          esExclusiva: true,
          servicios: '1|2|3|4|5|6|7',
          proveedorCuentaId: '30000042',
        },
      },
    ],
  };

  const crearServicio = () => {
    const prisma = {
      db: {
        clienteFinal: { findUniqueOrThrow: jest.fn().mockResolvedValue(clienteExclusivo) },
        cuenta: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'cuenta-exclusiva-1',
            esExclusiva: true,
            servicios: '1|2|3|4|5|6|7',
            dispositivos: [], // sin Dispositivos activos: hay lugar de sobra
          }),
        },
      },
    } as unknown as PrismaService;
    const proveedor = { consultarLicencias: jest.fn() } as unknown as ProveedorService;
    const servicio = new DispositivosService(
      prisma,
      {} as AuditService,
      {} as RequestContextService,
      proveedor,
      {} as CuentasProvisioningService,
      {} as ColaProveedorService,
    );
    return { servicio, prisma, proveedor };
  };

  it('encuentra la Cuenta existente aunque el único Dispositivo esté "disponible" y usa esa misma Cuenta', async () => {
    const { servicio, proveedor } = crearServicio();
    const altaSpy = jest.spyOn(servicio, 'alta').mockResolvedValue({
      dispositivo: { id: 'dispositivo-nuevo' } as never,
      cuenta: { id: 'cuenta-exclusiva-1' } as never,
      cuentaCreada: false,
      pendienteDeAutoprovision: true,
      solicitudVinculacionId: 'solicitud-1',
    });

    await servicio.altaAdicional('cliente-usuario-131', { operadorPrincipalId: 'operador-1' });

    expect(altaSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cuentaIdForzada: 'cuenta-exclusiva-1',
        servicios: '1|2|3|4|5|6|7',
      }),
    );
    // No hace falta consultar licencias: ya se encontró la Cuenta existente.
    expect(proveedor.consultarLicencias).not.toHaveBeenCalled();
  });
});
