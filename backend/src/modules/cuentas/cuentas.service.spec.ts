import { BadRequestException } from '@nestjs/common';
import { EstadoCuenta, EstadoDispositivo, MotivoFinVentanaCuriosidad } from '@prisma/client';
import { CuentasService } from './cuentas.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { VentanasCuriosidadService } from './ventanas-curiosidad.service';
import { CuentasProvisioningService } from './cuentas-provisioning.service';
import { ColaProveedorService } from '../../queues/cola-proveedor.service';
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
          findUnique: jest
            .fn()
            .mockResolvedValue(cuenta ? { ventasCompartidas: [], ...cuenta } : null),
          delete: cuentaDelete,
          update: cuentaUpdate,
        },
      },
    } as unknown as PrismaService;

    const cerrarCuentaProveedor = jest.fn().mockResolvedValue(undefined);
    const proveedor = { cerrarCuenta: cerrarCuentaProveedor } as unknown as ProveedorService;
    const audit = { registrar: jest.fn() } as unknown as AuditService;
    const contexto = { operadorPrincipalId: 'operador-1' } as unknown as RequestContextService;

    const servicio = new CuentasService(
      prisma,
      {} as CryptoService,
      contexto,
      proveedor,
      audit,
      {} as VentanasCuriosidadService,
      {} as CuentasProvisioningService,
      {} as ColaProveedorService,
    );
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

/**
 * =============================================================================
 * Cambio manual de contraseña de Cuenta (pedido de Bruno, 26/08/2026)
 * =============================================================================
 * La contraseña se sigue generando automáticamente en el alta; esto es la
 * posibilidad de reemplazarla a mano desde el panel de la Empresa Revendedora.
 * =============================================================================
 */
describe('CuentasService — cambiarPassword', () => {
  const crearServicio = (
    cuenta: Record<string, unknown> | null,
    opciones: { esOperador?: boolean } = {},
  ) => {
    const cuentaUpdate = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      db: {
        cuenta: {
          findUnique: jest.fn().mockResolvedValue(cuenta),
          update: cuentaUpdate,
        },
      },
    } as unknown as PrismaService;

    const actualizarPassword = jest.fn().mockResolvedValue(undefined);
    const proveedor = { actualizarPassword } as unknown as ProveedorService;
    const audit = { registrar: jest.fn() } as unknown as AuditService;
    const contexto = {
      operadorPrincipalId: 'operador-1',
      esOperador: opciones.esOperador ?? false,
    } as unknown as RequestContextService;
    const crypto = {
      encrypt: jest.fn((valor: string) => `cifrado:${valor}`),
    } as unknown as CryptoService;

    const servicio = new CuentasService(
      prisma,
      crypto,
      contexto,
      proveedor,
      audit,
      {} as VentanasCuriosidadService,
      {} as CuentasProvisioningService,
      {} as ColaProveedorService,
    );
    return { servicio, cuentaUpdate, actualizarPassword, audit, crypto };
  };

  it('rechaza el cambio si lo pide el Operador Principal', async () => {
    const { servicio } = crearServicio(
      { id: 'cuenta-1', proveedorCuentaId: '30000043', empresaRevendedoraId: 'empresa-1' },
      { esOperador: true },
    );

    await expect(servicio.cambiarPassword('cuenta-1', '12345678')).rejects.toThrow(
      'El Operador Principal no administra las credenciales',
    );
  });

  it('lanza NotFound si la Cuenta no existe', async () => {
    const { servicio } = crearServicio(null);

    await expect(servicio.cambiarPassword('cuenta-inexistente', '12345678')).rejects.toThrow(
      'La cuenta no existe o no está disponible.',
    );
  });

  it('rechaza si la Cuenta todavía no se confirmó en el Proveedor', async () => {
    const { servicio } = crearServicio({
      id: 'cuenta-1',
      proveedorCuentaId: null,
      empresaRevendedoraId: 'empresa-1',
    });

    await expect(servicio.cambiarPassword('cuenta-1', '12345678')).rejects.toThrow(
      'todavía no se confirmó en el Proveedor',
    );
  });

  it('actualiza la contraseña en SENSA, la cifra localmente y registra auditoría', async () => {
    const { servicio, cuentaUpdate, actualizarPassword, audit, crypto } = crearServicio({
      id: 'cuenta-1',
      proveedorCuentaId: '30000043',
      empresaRevendedoraId: 'empresa-1',
    });

    const resultado = await servicio.cambiarPassword('cuenta-1', '87654321');

    expect(actualizarPassword).toHaveBeenCalledWith('operador-1', {
      proveedorCuentaId: '30000043',
      password: '87654321',
    });
    expect(crypto.encrypt).toHaveBeenCalledWith('87654321');
    expect(cuentaUpdate).toHaveBeenCalledWith({
      where: { id: 'cuenta-1' },
      data: { passwordCifrado: 'cifrado:87654321' },
    });
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidadId: 'cuenta-1',
        detalle: expect.objectContaining({
          proveedor_cuenta_id: '30000043',
          modificado_manualmente: true,
        }),
      }),
    );
    // Nunca se guarda la contraseña en claro en el detalle del audit log.
    expect(audit.registrar).not.toHaveBeenCalledWith(
      expect.objectContaining({
        detalle: expect.objectContaining({ password: expect.anything() }),
      }),
    );
    expect(resultado).toEqual({ id: 'cuenta-1' });
  });
});

/**
 * =============================================================================
 * actualizarPropiedades — tipo de Cuenta y servicios
 * =============================================================================
 * Cambiar de tipo sólo es seguro con a lo sumo un Cliente Final activo; de
 * exclusiva a compartida, además, sin superar 2 Dispositivos por categoría
 * (el máximo de una venta es 2+2). Los servicios se editan en ambos tipos.
 * =============================================================================
 */
describe('CuentasService — actualizarPropiedades', () => {
  const dispositivo = (
    clienteFinalId: string | null,
    tipo: 'fijo' | 'movil',
    estado: EstadoDispositivo = EstadoDispositivo.activo,
  ) => ({ tipo, estado, clienteFinalId });

  const crearServicio = (
    cuentaPrevia: Record<string, unknown>,
    opciones: {
      cuentaFinal?: Record<string, unknown>;
      licencias?: Record<string, number>;
      esOperador?: boolean;
    } = {},
  ) => {
    const cuentaFindUnique = jest
      .fn()
      .mockResolvedValueOnce({
        ventasCompartidas: [],
        clienteFinalExclusivoId: null,
        ...cuentaPrevia,
      })
      .mockResolvedValueOnce({
        id: 'cuenta-1',
        proveedorCuentaId: '30000001',
        estado: 'activa',
        empresaRevendedoraId: 'empresa-1',
        usuario: 'user1',
        emailContacto: 'contacto1@isp.com',
        servicios: '1',
        passwordCifrado: 'x',
        pinCifrado: 'y',
        creadoEn: new Date(),
        dispositivos: [],
        ventasCompartidas: [],
        ...opciones.cuentaFinal,
      });
    const ventaCompartidaDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const ventaCompartidaCreate = jest.fn().mockResolvedValue({ id: 'venta-nueva' });
    const ventanaCuriosidadUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    const cuentaUpdate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      ventaCompartida: { deleteMany: ventaCompartidaDeleteMany, create: ventaCompartidaCreate },
      ventanaCuriosidad: { updateMany: ventanaCuriosidadUpdateMany },
      cuenta: { update: cuentaUpdate },
    };
    const prisma = {
      db: {
        cuenta: { findUnique: cuentaFindUnique },
        clienteFinal: { count: jest.fn().mockResolvedValue(1) },
      },
      operadorPrincipal: { findUnique: jest.fn().mockResolvedValue({ umbralAlertaCapacidad: 2 }) },
      transaction: jest.fn().mockImplementation((fn: (client: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const consultarLicencias = jest.fn().mockResolvedValue({
      compradas: opciones.licencias ?? { '1': 1, '3': 1, '5': 1 },
      usadas: {},
    });
    const actualizarServicios = jest.fn().mockResolvedValue(undefined);
    const proveedor = { consultarLicencias, actualizarServicios } as unknown as ProveedorService;
    const audit = { registrarEnTx: jest.fn() } as unknown as AuditService;
    const contexto = {
      operadorPrincipalId: 'operador-1',
      esOperador: opciones.esOperador ?? false,
    } as unknown as RequestContextService;
    const aplicarLimiteExclusiva = jest.fn().mockResolvedValue(undefined);
    const sincronizarContadoresVenta = jest.fn().mockResolvedValue(undefined);
    const provisioning = {
      aplicarLimiteExclusiva,
      sincronizarContadoresVenta,
    } as unknown as CuentasProvisioningService;
    const encolarSincronizacionContadoresVenta = jest.fn().mockResolvedValue(undefined);
    const cola = { encolarSincronizacionContadoresVenta } as unknown as ColaProveedorService;
    const ventanasCuriosidad = {
      obtenerEstadoEHistorial: jest.fn().mockResolvedValue({ activa: null, historial: [] }),
    } as unknown as VentanasCuriosidadService;

    const servicio = new CuentasService(
      prisma,
      {} as CryptoService,
      contexto,
      proveedor,
      audit,
      ventanasCuriosidad,
      provisioning,
      cola,
    );
    return {
      servicio,
      cuentaUpdate,
      ventaCompartidaDeleteMany,
      ventaCompartidaCreate,
      ventanaCuriosidadUpdateMany,
      actualizarServicios,
      audit,
      aplicarLimiteExclusiva,
      sincronizarContadoresVenta,
      encolarSincronizacionContadoresVenta,
      executeRaw: tx.$executeRaw,
    };
  };

  it('rechaza el pedido del Operador Principal', async () => {
    const { servicio } = crearServicio({ id: 'cuenta-1' }, { esOperador: true });

    await expect(
      servicio.actualizarPropiedades('cuenta-1', { es_exclusiva: true }),
    ).rejects.toThrow('El Operador Principal no administra');
  });

  it('rechaza si no se informa ningún cambio', async () => {
    const { servicio } = crearServicio({ id: 'cuenta-1' });

    await expect(servicio.actualizarPropiedades('cuenta-1', {})).rejects.toThrow(
      'Informe al menos un cambio',
    );
  });

  it('rechaza si la Cuenta todavía no se confirmó en el Proveedor', async () => {
    const { servicio } = crearServicio({ id: 'cuenta-1', proveedorCuentaId: null });

    await expect(
      servicio.actualizarPropiedades('cuenta-1', { es_exclusiva: true }),
    ).rejects.toThrow('todavía no se confirmó en el Proveedor');
  });

  it('permite editar servicios de una Cuenta exclusiva (ya no incluye todo automático)', async () => {
    const { servicio, actualizarServicios, cuentaUpdate } = crearServicio({
      id: 'cuenta-1',
      proveedorCuentaId: '30000001',
      esExclusiva: true,
      servicios: '1',
      empresaRevendedoraId: 'empresa-1',
      dispositivos: [],
    });

    await servicio.actualizarPropiedades('cuenta-1', { servicios: ['3'] });

    expect(actualizarServicios).toHaveBeenCalledWith('operador-1', {
      proveedorCuentaId: '30000001',
      servicios: '1|3',
    });
    expect(cuentaUpdate).toHaveBeenCalledWith({
      where: { id: 'cuenta-1' },
      data: {
        esExclusiva: true,
        servicios: '1|3',
      },
    });
  });

  it('rechaza el cambio de tipo con más de un Cliente Final activo', async () => {
    const { servicio } = crearServicio({
      id: 'cuenta-1',
      proveedorCuentaId: '30000001',
      esExclusiva: false,
      empresaRevendedoraId: 'empresa-1',
      dispositivos: [dispositivo('cliente-1', 'fijo'), dispositivo('cliente-2', 'movil')],
    });

    await expect(
      servicio.actualizarPropiedades('cuenta-1', { es_exclusiva: true }),
    ).rejects.toThrow('más de un Cliente Final activo');
  });

  it('rechaza pasar una Cuenta exclusiva a compartida', async () => {
    const { servicio } = crearServicio({
      id: 'cuenta-1',
      proveedorCuentaId: '30000001',
      esExclusiva: true,
      empresaRevendedoraId: 'empresa-1',
      dispositivos: [dispositivo('cliente-1', 'fijo')],
    });

    await expect(
      servicio.actualizarPropiedades('cuenta-1', { es_exclusiva: false }),
    ).rejects.toThrow('Una Cuenta exclusiva no puede convertirse en compartida');
  });

  it('rechaza pasar a compartida aun sin equipos (el tipo se fija al crearla)', async () => {
    const { servicio } = crearServicio({
      id: 'cuenta-1',
      proveedorCuentaId: '30000001',
      esExclusiva: true,
      clienteFinalExclusivoId: 'cliente-1',
      servicios: '1',
      empresaRevendedoraId: 'empresa-1',
      dispositivos: [],
      ventasCompartidas: [],
    });

    await expect(
      servicio.actualizarPropiedades('cuenta-1', { es_exclusiva: false }),
    ).rejects.toThrow('Una Cuenta exclusiva no puede convertirse en compartida');
  });

  it('convierte compartida a exclusiva: borra la venta, cierra la ventana y aplica 3/3', async () => {
    const {
      servicio,
      ventaCompartidaDeleteMany,
      ventanaCuriosidadUpdateMany,
      cuentaUpdate,
      audit,
      aplicarLimiteExclusiva,
    } = crearServicio(
      {
        id: 'cuenta-1',
        proveedorCuentaId: '30000001',
        esExclusiva: false,
        servicios: '1|3',
        empresaRevendedoraId: 'empresa-1',
        dispositivos: [dispositivo('cliente-1', 'fijo')],
      },
      { cuentaFinal: { esExclusiva: true } },
    );

    await servicio.actualizarPropiedades('cuenta-1', { es_exclusiva: true });

    expect(ventaCompartidaDeleteMany).toHaveBeenCalledWith({ where: { cuentaId: 'cuenta-1' } });
    expect(ventanaCuriosidadUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cuentaId: 'cuenta-1', finRealEn: null } }),
    );
    expect(cuentaUpdate).toHaveBeenCalledWith({
      where: { id: 'cuenta-1' },
      data: {
        esExclusiva: true,
        clienteFinalExclusivoId: 'cliente-1',
        servicios: '1|3',
      },
    });
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accion: 'cambio_tipo_cuenta' }),
    );
    expect(aplicarLimiteExclusiva).toHaveBeenCalledWith('cuenta-1', 'operador-1');
  });

  it('convierte compartida sin equipos a exclusiva conservando el Cliente Final de la venta', async () => {
    const { servicio, cuentaUpdate, executeRaw } = crearServicio(
      {
        id: 'cuenta-1',
        proveedorCuentaId: '30000001',
        esExclusiva: false,
        clienteFinalExclusivoId: null,
        servicios: '1',
        empresaRevendedoraId: 'empresa-1',
        dispositivos: [],
        ventasCompartidas: [{ clienteFinalId: 'cliente-1', cuposPorCategoria: 1 }],
      },
      { cuentaFinal: { esExclusiva: true } },
    );

    await servicio.actualizarPropiedades('cuenta-1', { es_exclusiva: true });

    expect(executeRaw).toHaveBeenCalled();
    expect(cuentaUpdate).toHaveBeenCalledWith({
      where: { id: 'cuenta-1' },
      data: {
        esExclusiva: true,
        clienteFinalExclusivoId: 'cliente-1',
        servicios: '1',
      },
    });
  });

  it('rechaza pasar una Cuenta exclusiva a compartida (con su propietario explícito)', async () => {
    const { servicio } = crearServicio(
      {
        id: 'cuenta-1',
        proveedorCuentaId: '30000001',
        esExclusiva: true,
        clienteFinalExclusivoId: 'cliente-1',
        servicios: '1',
        empresaRevendedoraId: 'empresa-1',
        dispositivos: [],
        ventasCompartidas: [],
      },
      { cuentaFinal: { esExclusiva: false } },
    );

    await expect(
      servicio.actualizarPropiedades('cuenta-1', { es_exclusiva: false }),
    ).rejects.toThrow('Una Cuenta exclusiva no puede convertirse en compartida');
  });

  it('cambia sólo los servicios de una Cuenta compartida: valida licencias y empuja a SENSA antes de guardar', async () => {
    const { servicio, actualizarServicios, cuentaUpdate, audit } = crearServicio({
      id: 'cuenta-1',
      proveedorCuentaId: '30000001',
      esExclusiva: false,
      servicios: '1',
      empresaRevendedoraId: 'empresa-1',
      dispositivos: [],
    });

    await servicio.actualizarPropiedades('cuenta-1', { servicios: ['3', '5'] });

    expect(actualizarServicios).toHaveBeenCalledWith('operador-1', {
      proveedorCuentaId: '30000001',
      servicios: '1|3|5',
    });
    expect(cuentaUpdate).toHaveBeenCalledWith({
      where: { id: 'cuenta-1' },
      data: { esExclusiva: false, servicios: '1|3|5' },
    });
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accion: 'cambio_servicios_cuenta' }),
    );
  });

  it('rechaza servicios no contratados', async () => {
    const { servicio } = crearServicio(
      {
        id: 'cuenta-1',
        proveedorCuentaId: '30000001',
        esExclusiva: false,
        servicios: '1',
        empresaRevendedoraId: 'empresa-1',
        dispositivos: [],
      },
      { licencias: { '1': 1 } },
    );

    await expect(servicio.actualizarPropiedades('cuenta-1', { servicios: ['9'] })).rejects.toThrow(
      'no están contratados',
    );
  });
});

/**
 * =============================================================================
 * ajustarSlotVentaCompartida — reserva 1+1/2+2 editable por venta
 * =============================================================================
 * Herramienta manual del vendedor para dar lugar a que un Cliente Final cargue
 * sus Dispositivos. Subir exige cupos libres en la Cuenta; bajar se rechaza si
 * el cliente ya cargó más de un equipo de una categoría.
 * =============================================================================
 */
describe('CuentasService — ajustarSlotVentaCompartida', () => {
  const crearServicio = (cuenta: Record<string, unknown>) => {
    const ventaUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      ventaCompartida: { updateMany: ventaUpdateMany },
    };
    const findUnique = jest.fn().mockResolvedValue(cuenta);
    const prisma = {
      db: { cuenta: { findUnique } },
      transaction: jest.fn().mockImplementation((fn: (client: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const audit = { registrarEnTx: jest.fn() } as unknown as AuditService;
    const contexto = {
      esOperador: false,
      operadorPrincipalId: 'operador-1',
    } as unknown as RequestContextService;
    const sincronizarContadoresVenta = jest.fn().mockResolvedValue(undefined);
    const provisioning = { sincronizarContadoresVenta } as unknown as CuentasProvisioningService;
    const encolarSincronizacionContadoresVenta = jest.fn();
    const cola = { encolarSincronizacionContadoresVenta } as unknown as ColaProveedorService;

    const servicio = new CuentasService(
      prisma,
      {} as CryptoService,
      contexto,
      {} as ProveedorService,
      audit,
      {} as VentanasCuriosidadService,
      provisioning,
      cola,
    );
    // `ajustarSlot` termina devolviendo `obtener()`, que no interesa acá.
    jest.spyOn(servicio, 'obtener').mockResolvedValue({} as never);

    return {
      servicio,
      ventaUpdateMany,
      audit,
      sincronizarContadoresVenta,
      encolarSincronizacionContadoresVenta,
    };
  };

  const baseCuenta = {
    id: 'cuenta-1',
    esExclusiva: false,
    proveedorCuentaId: '30000001',
    empresaRevendedoraId: 'empresa-1',
    ventasCompartidas: [{ clienteFinalId: 'cliente-1', cuposPorCategoria: 1 }],
    dispositivos: [],
  };

  it('agranda una venta 1+1 a 2+2 y sincroniza los contadores', async () => {
    const { servicio, ventaUpdateMany, audit, sincronizarContadoresVenta } =
      crearServicio(baseCuenta);

    await servicio.ajustarSlotVentaCompartida('cuenta-1', 'cliente-1', {
      cupos_por_categoria: 2,
    });

    expect(ventaUpdateMany).toHaveBeenCalledWith({
      where: { cuentaId: 'cuenta-1', clienteFinalId: 'cliente-1' },
      data: { cuposPorCategoria: 2 },
    });
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        accion: 'cambio_slots_cuenta',
        detalle: expect.objectContaining({ cupos_anterior: 1, cupos_nuevo: 2 }),
      }),
    );
    expect(sincronizarContadoresVenta).toHaveBeenCalledWith('cuenta-1', 'operador-1');
  });

  it('rechaza agrandar si la suma de ventas supera los 3 cupos por categoría', async () => {
    const { servicio, ventaUpdateMany } = crearServicio({
      ...baseCuenta,
      ventasCompartidas: [
        { clienteFinalId: 'cliente-1', cuposPorCategoria: 2 },
        { clienteFinalId: 'cliente-2', cuposPorCategoria: 1 },
      ],
    });

    await expect(
      servicio.ajustarSlotVentaCompartida('cuenta-1', 'cliente-2', {
        cupos_por_categoria: 2,
      }),
    ).rejects.toThrow('No quedan cupos en esta Cuenta');
    expect(ventaUpdateMany).not.toHaveBeenCalled();
  });

  it('rechaza reducir a 1+1 si el Cliente Final ya cargó más de un equipo de una categoría', async () => {
    const { servicio, ventaUpdateMany } = crearServicio({
      ...baseCuenta,
      ventasCompartidas: [{ clienteFinalId: 'cliente-1', cuposPorCategoria: 2 }],
      dispositivos: [
        { tipo: 'movil', estado: EstadoDispositivo.activo, clienteFinalId: 'cliente-1' },
        { tipo: 'movil', estado: EstadoDispositivo.activo, clienteFinalId: 'cliente-1' },
        { tipo: 'fijo', estado: EstadoDispositivo.activo, clienteFinalId: 'cliente-1' },
      ],
    });

    await expect(
      servicio.ajustarSlotVentaCompartida('cuenta-1', 'cliente-1', {
        cupos_por_categoria: 1,
      }),
    ).rejects.toThrow('no se puede reducir');
    expect(ventaUpdateMany).not.toHaveBeenCalled();
  });

  it('rechaza tocar una venta que no existe', async () => {
    const { servicio } = crearServicio(baseCuenta);

    await expect(
      servicio.ajustarSlotVentaCompartida('cuenta-1', 'cliente-inexistente', {
        cupos_por_categoria: 1,
      }),
    ).rejects.toThrow('no tiene una venta en esta Cuenta');
  });
});

/**
 * HU-A02 — Aislamiento de una Cuenta compartida existente.
 *
 * Sólo se puede aislar una Cuenta compartida con exactamente un Cliente Final
 * ACTIVO. El aislamiento reemplaza a la Ventana de Alta (la revoca) y bloquea el
 * ingreso de clientes nuevos durante los días indicados.
 */
describe('CuentasService — aislarCuenta (HU-A02)', () => {
  const crearServicio = (
    opciones: { esExclusiva?: boolean; activos?: number; ventanaVigente?: boolean } = {},
  ) => {
    const clienteFinalFindMany = jest
      .fn()
      .mockResolvedValue(
        Array.from({ length: opciones.activos ?? 1 }, (_, indice) => ({ id: `cliente-${indice}` })),
      );
    const ventanaUpdateMany = jest
      .fn()
      .mockResolvedValue({ count: opciones.ventanaVigente ? 1 : 0 });
    const cuentaUpdate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      cuenta: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cuenta-1',
          esExclusiva: opciones.esExclusiva ?? false,
          empresaRevendedoraId: 'empresa-1',
        }),
        update: cuentaUpdate,
      },
      clienteFinal: { findMany: clienteFinalFindMany },
      ventanaCuriosidad: { updateMany: ventanaUpdateMany },
    };
    const prisma = {
      transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const audit = {
      registrarEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const contexto = {
      esOperador: false,
      empresaRevendedoraId: 'empresa-1',
      teamMemberId: 'team-1',
    } as unknown as RequestContextService;

    const servicio = new CuentasService(
      prisma,
      {} as CryptoService,
      contexto,
      {} as ProveedorService,
      audit,
      {} as VentanasCuriosidadService,
      {} as CuentasProvisioningService,
      {} as ColaProveedorService,
    );
    jest.spyOn(servicio, 'obtener').mockResolvedValue({ id: 'cuenta-1' } as never);
    return { servicio, ventanaUpdateMany, cuentaUpdate, audit };
  };

  it('rechaza aislar una Cuenta exclusiva', async () => {
    const { servicio } = crearServicio({ esExclusiva: true });

    await expect(servicio.aislarCuenta('cuenta-1', 30)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza aislar una Cuenta sin Clientes Finales activos', async () => {
    const { servicio } = crearServicio({ activos: 0 });

    await expect(servicio.aislarCuenta('cuenta-1', 30)).rejects.toThrow(
      'no tiene Clientes Finales activos',
    );
  });

  it('rechaza aislar una Cuenta con más de un Cliente Final activo', async () => {
    const { servicio } = crearServicio({ activos: 2 });

    await expect(servicio.aislarCuenta('cuenta-1', 30)).rejects.toThrow(
      'exactamente un Cliente Final activo',
    );
  });

  it('rechaza días inválidos', async () => {
    const { servicio } = crearServicio();

    await expect(servicio.aislarCuenta('cuenta-1', 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aísla la Cuenta: revoca la ventana, marca el estado y audita', async () => {
    const { servicio, ventanaUpdateMany, cuentaUpdate, audit } = crearServicio({
      ventanaVigente: true,
    });

    await servicio.aislarCuenta('cuenta-1', 30);

    expect(ventanaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          motivoFin: MotivoFinVentanaCuriosidad.reemplazo_por_aislamiento,
        }),
      }),
    );
    expect(cuentaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ aislada: true }) }),
    );
    expect(audit.registrarEnTx).toHaveBeenCalled();
  });
});

/**
 * HU-A03 — Fin del aislamiento por revocación manual. Vuelve la Cuenta a
 * `Compartida` sin tocar ventanas ni capacidad y audita como acción del usuario.
 */
describe('CuentasService — revocarAislamiento (HU-A03)', () => {
  const crearServicio = (aislada: boolean) => {
    const cuentaUpdate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      cuenta: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cuenta-1',
          aislada,
          empresaRevendedoraId: 'empresa-1',
        }),
        update: cuentaUpdate,
      },
    };
    const prisma = {
      transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const audit = {
      registrarEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const contexto = {
      esOperador: false,
      empresaRevendedoraId: 'empresa-1',
      teamMemberId: 'team-1',
    } as unknown as RequestContextService;

    const servicio = new CuentasService(
      prisma,
      {} as CryptoService,
      contexto,
      {} as ProveedorService,
      audit,
      {} as VentanasCuriosidadService,
      {} as CuentasProvisioningService,
      {} as ColaProveedorService,
    );
    jest.spyOn(servicio, 'obtener').mockResolvedValue({ id: 'cuenta-1' } as never);
    return { servicio, cuentaUpdate, audit };
  };

  it('quita el aislamiento y lo audita como acción manual', async () => {
    const { servicio, cuentaUpdate, audit } = crearServicio(true);

    await servicio.revocarAislamiento('cuenta-1');

    expect(cuentaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { aislada: false, aislamientoFinEn: null } }),
    );
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        accion: 'fin_aislamiento_cuenta',
        detalle: expect.objectContaining({ origen: 'manual' }),
      }),
    );
  });

  it('rechaza si la Cuenta no está aislada', async () => {
    const { servicio } = crearServicio(false);

    await expect(servicio.revocarAislamiento('cuenta-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('CuentasService — convertir prueba a permanente (HU-P05)', () => {
  const crearServicio = (
    cuenta: Record<string, unknown> | null,
    opciones: { esOperador?: boolean } = {},
  ) => {
    const cuentaUpdate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      cuenta: {
        findUnique: jest.fn().mockResolvedValue(cuenta),
        update: cuentaUpdate,
        // `obtener()` corre después de la conversión.
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const prisma = {
      db: {
        cuenta: {
          findUnique: jest.fn().mockResolvedValue(cuenta),
          groupBy: jest.fn().mockResolvedValue([]),
        },
        dispositivo: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn(async () => []) },
        ventaCompartida: { findMany: jest.fn().mockResolvedValue([]) },
        clienteFinal: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn(async () => []) },
        incidenciaDispositivoProveedor: { count: jest.fn().mockResolvedValue(0) },
      },
      transaction: jest.fn().mockImplementation((fn: (client: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const audit = { registrarEnTx: jest.fn() } as unknown as AuditService;
    const contexto = {
      esOperador: opciones.esOperador ?? false,
      empresaRevendedoraId: opciones.esOperador ? null : 'empresa-1',
      teamMemberId: 'team-1',
    } as unknown as RequestContextService;
    const abrirManualmente = jest.fn().mockResolvedValue({});
    const ventanasCuriosidad = { abrirManualmente } as unknown as VentanasCuriosidadService;

    const servicio = new CuentasService(
      prisma,
      {} as CryptoService,
      contexto,
      {} as ProveedorService,
      audit,
      ventanasCuriosidad,
      {} as CuentasProvisioningService,
      {} as ColaProveedorService,
    );
    // La conversión devuelve `obtener()`: no hace falta armar todo su mock.
    jest.spyOn(servicio, 'obtener').mockResolvedValue({ id: 'cuenta-1' } as never);

    return { servicio, cuentaUpdate, audit, abrirManualmente };
  };

  it('quita la condición de prueba, conserva el consumo y audita', async () => {
    const { servicio, cuentaUpdate, audit } = crearServicio({
      id: 'cuenta-1',
      empresaRevendedoraId: 'empresa-1',
      esPrueba: true,
      esExclusiva: false,
      pruebaVenceEn: new Date('2026-10-29T12:00:00Z'),
    });

    await servicio.convertirPruebaAPermanente('cuenta-1', {});

    expect(cuentaUpdate).toHaveBeenCalledWith({
      where: { id: 'cuenta-1' },
      data: { esPrueba: false, pruebaVenceEn: null },
    });
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accion: 'conversion_cuenta_prueba' }),
    );
  });

  it('no abre Ventana de Alta si no se pidió', async () => {
    const { servicio, abrirManualmente } = crearServicio({
      id: 'cuenta-1',
      empresaRevendedoraId: 'empresa-1',
      esPrueba: true,
      esExclusiva: false,
    });

    await servicio.convertirPruebaAPermanente('cuenta-1', {});

    expect(abrirManualmente).not.toHaveBeenCalled();
  });

  it('abre la Ventana de Alta opcional en una Cuenta compartida', async () => {
    const { servicio, abrirManualmente } = crearServicio({
      id: 'cuenta-1',
      empresaRevendedoraId: 'empresa-1',
      esPrueba: true,
      esExclusiva: false,
    });

    await servicio.convertirPruebaAPermanente('cuenta-1', {
      duracion_ventana_curiosidad_minutos: 1440,
    });

    expect(abrirManualmente).toHaveBeenCalledWith('cuenta-1', 1440);
  });

  it('rechaza la Ventana de Alta en una Cuenta exclusiva', async () => {
    const { servicio } = crearServicio({
      id: 'cuenta-1',
      empresaRevendedoraId: 'empresa-1',
      esPrueba: true,
      esExclusiva: true,
    });

    await expect(
      servicio.convertirPruebaAPermanente('cuenta-1', {
        duracion_ventana_curiosidad_minutos: 1440,
      }),
    ).rejects.toThrow('no admite una Ventana de Alta');
  });

  it('rechaza una Cuenta que no es de prueba', async () => {
    const { servicio } = crearServicio({
      id: 'cuenta-1',
      empresaRevendedoraId: 'empresa-1',
      esPrueba: false,
      esExclusiva: false,
    });

    await expect(servicio.convertirPruebaAPermanente('cuenta-1', {})).rejects.toThrow(
      'no es una cuenta de prueba',
    );
  });

  it('rechaza el pedido del Operador Principal', async () => {
    const { servicio } = crearServicio(
      { id: 'cuenta-1', empresaRevendedoraId: 'empresa-1', esPrueba: true, esExclusiva: false },
      { esOperador: true },
    );

    await expect(servicio.convertirPruebaAPermanente('cuenta-1', {})).rejects.toThrow(
      'Sólo la Empresa Revendedora',
    );
  });
});
