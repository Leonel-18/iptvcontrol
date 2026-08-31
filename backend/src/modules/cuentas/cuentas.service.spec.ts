import { EstadoCuenta, EstadoDispositivo } from '@prisma/client';
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
 * (el máximo de una venta es 2+2). Los servicios sólo se editan manualmente
 * en una Cuenta compartida.
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
      .mockResolvedValueOnce(cuentaPrevia)
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
      $queryRaw: jest.fn().mockResolvedValue([]),
      ventaCompartida: { deleteMany: ventaCompartidaDeleteMany, create: ventaCompartidaCreate },
      ventanaCuriosidad: { updateMany: ventanaCuriosidadUpdateMany },
      cuenta: { update: cuentaUpdate },
    };
    const prisma = {
      db: { cuenta: { findUnique: cuentaFindUnique } },
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

  it('rechaza servicios manuales para una Cuenta que queda exclusiva', async () => {
    const { servicio } = crearServicio({
      id: 'cuenta-1',
      proveedorCuentaId: '30000001',
      esExclusiva: true,
      dispositivos: [],
    });

    await expect(servicio.actualizarPropiedades('cuenta-1', { servicios: ['3'] })).rejects.toThrow(
      'no permite elegir servicios manualmente',
    );
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

  it('rechaza pasar a compartida si excede 2 Dispositivos por categoría', async () => {
    const { servicio } = crearServicio({
      id: 'cuenta-1',
      proveedorCuentaId: '30000001',
      esExclusiva: true,
      empresaRevendedoraId: 'empresa-1',
      dispositivos: [
        dispositivo('cliente-1', 'fijo'),
        dispositivo('cliente-1', 'fijo'),
        dispositivo('cliente-1', 'fijo'),
      ],
    });

    await expect(
      servicio.actualizarPropiedades('cuenta-1', { es_exclusiva: false }),
    ).rejects.toThrow('no entra en una venta compartida');
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
      data: { esExclusiva: true, servicios: '1|3' },
    });
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accion: 'cambio_tipo_cuenta' }),
    );
    expect(aplicarLimiteExclusiva).toHaveBeenCalledWith('cuenta-1', 'operador-1');
  });

  it('convierte exclusiva a compartida: crea la venta 1+1 para el único cliente', async () => {
    const { servicio, ventaCompartidaCreate, cuentaUpdate, sincronizarContadoresVenta } =
      crearServicio(
        {
          id: 'cuenta-1',
          proveedorCuentaId: '30000001',
          esExclusiva: true,
          servicios: '1|2|3',
          empresaRevendedoraId: 'empresa-1',
          dispositivos: [dispositivo('cliente-1', 'fijo')],
        },
        { cuentaFinal: { esExclusiva: false } },
      );

    await servicio.actualizarPropiedades('cuenta-1', { es_exclusiva: false });

    expect(ventaCompartidaCreate).toHaveBeenCalledWith({
      data: {
        cuentaId: 'cuenta-1',
        clienteFinalId: 'cliente-1',
        empresaRevendedoraId: 'empresa-1',
        cuposPorCategoria: 1,
      },
    });
    expect(cuentaUpdate).toHaveBeenCalledWith({
      where: { id: 'cuenta-1' },
      data: { esExclusiva: false, servicios: '1|2|3' },
    });
    expect(sincronizarContadoresVenta).toHaveBeenCalledWith('cuenta-1', 'operador-1');
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
