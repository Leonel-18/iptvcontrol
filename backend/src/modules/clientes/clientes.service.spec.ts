import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  EstadoClienteFinal,
  EstadoCuenta,
  EstadoDispositivo,
  TipoAltaClienteFinal,
} from '@prisma/client';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { DispositivosService } from '../dispositivos/dispositivos.service';
import { IdentificadoresService } from '../cuentas/identificadores.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { PruebasService } from '../pruebas/pruebas.service';
import { ListarClientesQueryDto } from './dto/listar-clientes.query';

/**
 * =============================================================================
 * Test de regresión de la regla de negocio 4.2
 * =============================================================================
 * Detectado en una auditoría: el listado de Clientes Finales serializaba nombre,
 * teléfono, correo y dirección **también para el Operador Principal**, que por la
 * tabla normativa de docs/03_Reglas_de_Negocio.md sección 4.2 no debe recibirlos.
 * El frontend los ocultaba, pero la sección 5.3 de la convención de rutas es
 * explícita: "nunca llegan al front-end, no es un tema de ocultarlos visualmente".
 *
 * Estos tests fijan el comportamiento correcto para que no vuelva a pasar.
 * =============================================================================
 */
describe('ClientesService — visibilidad según el rol (regla 4.2)', () => {
  const clienteEnBase = {
    id: 'cliente-1',
    empresaRevendedoraId: 'empresa-1',
    numeroCliente: 42,
    idGestionExterno: 'CRM-9001',
    nombre: 'Juan',
    apellido: 'Pérez',
    telefono: '2615550000',
    email: 'juan.perez@correo.test',
    direccion: 'Calle Falsa 123',
    tipoAlta: TipoAltaClienteFinal.dispositivo_compartido,
    estado: EstadoClienteFinal.activo,
    suspendidoEn: null,
    dadoDeBajaEn: null,
    creadoEn: new Date('2026-08-01T10:00:00Z'),
    actualizadoEn: new Date('2026-08-01T10:00:00Z'),
    dispositivos: [
      { id: 'dispositivo-1', tipo: 'fijo', estado: EstadoDispositivo.activo, cuentaId: 'cuenta-1' },
      {
        id: 'dispositivo-2',
        tipo: 'movil',
        estado: EstadoDispositivo.disponible,
        cuentaId: 'cuenta-1',
      },
    ],
  };

  /** Arma el servicio con las dependencias mínimas simuladas. */
  const crearServicio = (esOperador: boolean) => {
    const findMany = jest.fn().mockResolvedValue([clienteEnBase]);
    const count = jest.fn().mockResolvedValue(1);

    const prisma = {
      db: {
        clienteFinal: { findMany, count },
        // HU-A04: el listado consulta el aislamiento de las Cuentas de la página.
        cuenta: { findMany: jest.fn().mockResolvedValue([]) },
      },
    } as unknown as PrismaService;

    const contexto = {
      esOperador,
      empresaRevendedoraId: esOperador ? null : 'empresa-1',
      operadorPrincipalId: 'operador-1',
      teamMemberId: 'team-1',
      get: () => ({ esOperador }),
    } as unknown as RequestContextService;

    const servicio = new ClientesService(
      prisma,
      {} as AuditService,
      {} as CryptoService,
      contexto,
      {} as DispositivosService,
      {} as IdentificadoresService,
      {} as ProveedorService,
      {} as PruebasService,
    );

    return { servicio, findMany };
  };

  const listar = async (esOperador: boolean, q?: string) => {
    const { servicio, findMany } = crearServicio(esOperador);
    const query = new ListarClientesQueryDto();
    query.page = 1;
    query.per_page = 25;
    query.q = q;
    const resultado = await servicio.listar(query);
    return { fila: resultado.data[0] as Record<string, unknown>, findMany };
  };

  describe('panel del Operador Principal', () => {
    it('NO serializa nombre ni datos de contacto del Cliente Final', async () => {
      const { fila } = await listar(true);

      for (const prohibido of [
        'nombre',
        'apellido',
        'nombre_completo',
        'telefono',
        'email',
        'direccion',
      ]) {
        expect(fila).not.toHaveProperty(prohibido);
      }

      // Tampoco por serialización indirecta: el JSON no debe contener el dato.
      const json = JSON.stringify(fila);
      expect(json).not.toContain('Juan');
      expect(json).not.toContain('Pérez');
      expect(json).not.toContain('2615550000');
      expect(json).not.toContain('juan.perez@correo.test');
      expect(json).not.toContain('Calle Falsa 123');
    });

    it('tampoco expone el ID del CRM de la Empresa Revendedora', async () => {
      const { fila } = await listar(true);
      expect(fila).not.toHaveProperty('id_gestion_externo');
      expect(JSON.stringify(fila)).not.toContain('CRM-9001');
    });

    it('sí expone los campos permitidos: ID, número de cliente, estado y conteo', async () => {
      const { fila } = await listar(true);

      expect(fila.id).toBe('cliente-1');
      expect(fila.numero_cliente).toBe(42);
      expect(fila.estado).toBe(EstadoClienteFinal.activo);
      expect(fila.tipo_alta).toBe(TipoAltaClienteFinal.dispositivo_compartido);
      expect(fila.empresa_revendedora_id).toBe('empresa-1');
      // Sólo cuentan los dispositivos que ocupan lugar: el `disponible` no.
      expect(fila.cantidad_dispositivos).toBe(1);
      expect(fila.cuenta_ids).toEqual(['cuenta-1']);
    });

    it('no puede buscar por nombre, teléfono, correo ni dirección', async () => {
      // Filtrar por un campo prohibido permitiría confirmar su contenido por
      // prueba y error, que es la misma fuga por otra vía.
      const { findMany } = await listar(true, 'Juan');
      const where = findMany.mock.calls[0][0].where as { OR?: Record<string, unknown>[] };

      const camposBuscados = (where.OR ?? []).flatMap((condicion) => Object.keys(condicion));
      expect(camposBuscados).toEqual(['idGestionExterno']);
      expect(camposBuscados).not.toContain('nombre');
      expect(camposBuscados).not.toContain('telefono');
      expect(camposBuscados).not.toContain('email');
    });
  });

  describe('panel de la Empresa Revendedora', () => {
    it('sí recibe los datos de su propio cliente', async () => {
      const { fila } = await listar(false);

      expect(fila.nombre).toBe('Juan');
      expect(fila.nombre_completo).toBe('Juan Pérez');
      expect(fila.telefono).toBe('2615550000');
      expect(fila.email).toBe('juan.perez@correo.test');
      expect(fila.direccion).toBe('Calle Falsa 123');
      expect(fila.id_gestion_externo).toBe('CRM-9001');
    });

    it('puede buscar por los datos de sus clientes', async () => {
      const { findMany } = await listar(false, 'Juan');
      const where = findMany.mock.calls[0][0].where as { OR?: Record<string, unknown>[] };

      const camposBuscados = (where.OR ?? []).flatMap((condicion) => Object.keys(condicion));
      expect(camposBuscados).toContain('nombre');
      expect(camposBuscados).toContain('telefono');
      expect(camposBuscados).toContain('email');
      expect(camposBuscados).toContain('idGestionExterno');
    });
  });
});

describe('ClientesService — ciclo de vida de una venta compartida', () => {
  const crearServicio = () => {
    const cliente = {
      id: 'cliente-1',
      empresaRevendedoraId: 'empresa-1',
      numeroCliente: 10,
      estado: EstadoClienteFinal.activo,
      dispositivos: [
        {
          id: 'dispositivo-1',
          estado: EstadoDispositivo.activo,
          notaDescriptiva: null,
        },
      ],
      ventasCompartidas: [{ cuentaId: 'cuenta-1', cuposPorCategoria: 2 }],
    };
    const ventaDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      ventanaCuriosidad: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      clienteFinal: { update: jest.fn().mockResolvedValue(undefined) },
      ventaCompartida: { deleteMany: ventaDeleteMany },
    };
    const prisma = {
      db: { clienteFinal: { findUnique: jest.fn().mockResolvedValue(cliente) } },
      transaction: jest.fn().mockImplementation((fn: (client: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const dispositivos = {
      operadorPrincipalId: jest.fn().mockResolvedValue('operador-1'),
      liberar: jest.fn().mockResolvedValue(undefined),
      sincronizarCapacidadCuenta: jest.fn().mockResolvedValue(undefined),
    } as unknown as DispositivosService;
    const audit = {
      registrarEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const servicio = new ClientesService(
      prisma,
      audit,
      {} as CryptoService,
      { esOperador: false } as RequestContextService,
      dispositivos,
      {} as IdentificadoresService,
      {} as ProveedorService,
      {} as PruebasService,
    );
    jest.spyOn(servicio, 'obtener').mockResolvedValue({ id: cliente.id } as never);
    return { servicio, dispositivos, ventaDeleteMany };
  };

  it('conserva los cupos 2+2 durante una suspensión', async () => {
    const { servicio, dispositivos, ventaDeleteMany } = crearServicio();

    await servicio.suspender('cliente-1');

    expect(ventaDeleteMany).not.toHaveBeenCalled();
    expect(dispositivos.sincronizarCapacidadCuenta).not.toHaveBeenCalled();
  });

  it('libera los cupos y resincroniza la Cuenta en la baja definitiva', async () => {
    const { servicio, dispositivos, ventaDeleteMany } = crearServicio();

    await servicio.darDeBaja('cliente-1');

    expect(ventaDeleteMany).toHaveBeenCalledWith({ where: { clienteFinalId: 'cliente-1' } });
    expect(dispositivos.sincronizarCapacidadCuenta).toHaveBeenCalledWith('cuenta-1', 'operador-1');
  });
});

/**
 * =============================================================================
 * ClientesService — crear() con `cuenta_id` (alta contextual en una Cuenta)
 * =============================================================================
 * Este flujo permite cargar Clientes Finales desde una Cuenta, usando la firma
 * de servicios que ya tiene fijada (no una elegida en el wizard). Una exclusiva
 * sólo admite su primer titular; una compartida admite nuevas ventas con lugar.
 * =============================================================================
 */
describe('ClientesService — crear() con carga manual en Cuenta (cuenta_id)', () => {
  const dtoBase = {
    nombre: 'Ana',
    dni: '30123456',
    tipo_alta: TipoAltaClienteFinal.dispositivo_compartido,
    cupos_por_categoria: 1 as const,
    dispositivo: {},
  };

  const crearServicio = (cuenta: Record<string, unknown> | null) => {
    const cuentaPersistida = cuenta ? { passwordCifrado: 'password-cifrado', ...cuenta } : null;
    const clienteCreado = {
      id: 'cliente-nuevo',
      empresaRevendedoraId: 'empresa-1',
      numeroCliente: 5,
    };
    const cuentaUpdate = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      clienteFinal: { create: jest.fn().mockResolvedValue(clienteCreado) },
      cuenta: { updateMany: cuentaUpdate },
    };
    const prisma = {
      db: {
        cuenta: { findUnique: jest.fn().mockResolvedValue(cuentaPersistida) },
        clienteFinal: { delete: jest.fn().mockResolvedValue(undefined) },
      },
      transaction: jest.fn().mockImplementation((fn: (client: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const contexto = {
      esOperador: false,
      empresaRevendedoraId: 'empresa-1',
    } as unknown as RequestContextService;
    const alta = jest.fn().mockResolvedValue({
      cuenta: { id: 'cuenta-vacia' },
      cuentaCreada: false,
      pendienteDeAutoprovision: true,
      solicitudVinculacionId: 'solicitud-1',
    });
    const reservarVentaContextual = jest.fn().mockResolvedValue(undefined);
    const dispositivos = {
      operadorPrincipalId: jest.fn().mockResolvedValue('operador-1'),
      alta,
      reservarVentaContextual,
    } as unknown as DispositivosService;
    const identificadores = {
      siguienteNumeroCliente: jest.fn().mockResolvedValue(5),
    } as unknown as IdentificadoresService;
    const audit = { registrar: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;

    const servicio = new ClientesService(
      prisma,
      audit,
      {} as CryptoService,
      contexto,
      dispositivos,
      identificadores,
      {} as ProveedorService,
      {} as PruebasService,
    );
    jest.spyOn(servicio, 'obtener').mockResolvedValue({ id: clienteCreado.id } as never);
    return { servicio, alta, reservarVentaContextual, audit, prisma, cuentaUpdate };
  };

  it('asigna el primer Cliente Final a una Cuenta exclusiva sin crear un Dispositivo ficticio', async () => {
    const { servicio, alta, cuentaUpdate } = crearServicio({
      id: 'cuenta-vacia',
      esExclusiva: true,
      clienteFinalExclusivoId: null,
      estado: EstadoCuenta.activa,
      proveedorCuentaId: 'proveedor-cuenta-1',
      servicios: '1|3',
      dispositivos: [],
      ventasCompartidas: [],
    });

    await servicio.crear({
      ...dtoBase,
      tipo_alta: TipoAltaClienteFinal.cuenta_exclusiva,
      cupos_por_categoria: undefined,
      cuenta_id: 'cuenta-vacia',
    });

    expect(cuentaUpdate).toHaveBeenCalledWith({
      where: { id: 'cuenta-vacia', clienteFinalExclusivoId: null },
      data: { clienteFinalExclusivoId: 'cliente-nuevo' },
    });
    expect(alta).not.toHaveBeenCalled();
  });

  it('rechaza si además se envían servicios', async () => {
    const { servicio } = crearServicio(null);

    await expect(
      servicio.crear({ ...dtoBase, cuenta_id: 'cuenta-vacia', servicios: ['3'] }),
    ).rejects.toThrow('ya tiene servicios fijados');
  });

  it('rechaza si la Cuenta no existe', async () => {
    const { servicio } = crearServicio(null);

    await expect(servicio.crear({ ...dtoBase, cuenta_id: 'cuenta-vacia' })).rejects.toThrow(
      'no existe o no está disponible',
    );
  });

  it('rechaza una Cuenta importada hasta que se configure su contraseña', async () => {
    const { servicio } = crearServicio({
      id: 'cuenta-vacia',
      esExclusiva: true,
      clienteFinalExclusivoId: null,
      estado: EstadoCuenta.activa,
      proveedorCuentaId: 'proveedor-cuenta-1',
      passwordCifrado: null,
      servicios: '1',
      dispositivos: [],
      ventasCompartidas: [],
    });

    await expect(
      servicio.crear({
        ...dtoBase,
        tipo_alta: TipoAltaClienteFinal.cuenta_exclusiva,
        cupos_por_categoria: undefined,
        cuenta_id: 'cuenta-vacia',
      }),
    ).rejects.toThrow('Configure la contraseña de la Cuenta importada');
  });

  it('rechaza una Cuenta exclusiva que ya tiene propietario', async () => {
    const { servicio } = crearServicio({
      id: 'cuenta-vacia',
      esExclusiva: true,
      clienteFinalExclusivoId: 'cliente-existente',
      estado: EstadoCuenta.activa,
      proveedorCuentaId: 'proveedor-cuenta-1',
      servicios: '1',
      dispositivos: [],
      ventasCompartidas: [],
    });

    await expect(
      servicio.crear({
        ...dtoBase,
        tipo_alta: TipoAltaClienteFinal.cuenta_exclusiva,
        cupos_por_categoria: undefined,
        cuenta_id: 'cuenta-vacia',
      }),
    ).rejects.toThrow('ya tiene un Cliente Final asignado');
  });

  it('permite sumar otro Cliente Final a una Cuenta compartida con clientes', async () => {
    const { servicio, alta, reservarVentaContextual } = crearServicio({
      id: 'cuenta-vacia',
      esExclusiva: false,
      estado: EstadoCuenta.activa,
      clienteFinalExclusivoId: null,
      proveedorCuentaId: 'proveedor-cuenta-1',
      servicios: '1|3',
      dispositivos: [{ estado: EstadoDispositivo.activo, clienteFinalId: 'cliente-otro' }],
      ventasCompartidas: [{ id: 'venta-existente' }],
    });

    await servicio.crear({ ...dtoBase, cuenta_id: 'cuenta-vacia' });

    expect(alta).not.toHaveBeenCalled();
    expect(reservarVentaContextual).toHaveBeenCalledWith(
      expect.objectContaining({
        cuentaId: 'cuenta-vacia',
        clienteFinalId: 'cliente-nuevo',
        cuposPorCategoria: 1,
      }),
    );
  });

  it('carga el primer cliente usando la firma de servicios ya fijada en la Cuenta', async () => {
    const { servicio, alta, reservarVentaContextual, audit } = crearServicio({
      id: 'cuenta-vacia',
      esExclusiva: false,
      estado: EstadoCuenta.activa,
      proveedorCuentaId: 'proveedor-cuenta-1',
      servicios: '1|3|5',
      dispositivos: [],
      ventasCompartidas: [],
    });

    await servicio.crear({ ...dtoBase, cuenta_id: 'cuenta-vacia', cupos_por_categoria: 2 });

    expect(alta).not.toHaveBeenCalled();
    expect(reservarVentaContextual).toHaveBeenCalledWith(
      expect.objectContaining({
        cuentaId: 'cuenta-vacia',
        clienteFinalId: 'cliente-nuevo',
        cuposPorCategoria: 2,
      }),
    );
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        detalle: expect.objectContaining({ cargado_manualmente_en_cuenta: true }),
      }),
    );
  });
});

/**
 * "Aislar Cuenta" (HU-A01): crea una Cuenta compartida nueva y aislada, con el
 * aislamiento expresado en DÍAS. Estas validaciones corren antes de tocar el
 * Proveedor, así que se prueban con un servicio mínimo (sólo contexto + operador).
 */
describe('ClientesService — validación de Aislar Cuenta', () => {
  const crearServicio = () => {
    const contexto = {
      esOperador: false,
      empresaRevendedoraId: 'empresa-1',
    } as unknown as RequestContextService;
    const dispositivos = {
      operadorPrincipalId: jest.fn().mockResolvedValue('operador-1'),
    } as unknown as DispositivosService;

    const servicio = new ClientesService(
      {} as PrismaService,
      {} as AuditService,
      {} as CryptoService,
      contexto,
      dispositivos,
      {} as IdentificadoresService,
      {} as ProveedorService,
      {} as PruebasService,
    );
    return { servicio };
  };

  const dtoAislado = (extra: Record<string, unknown> = {}) => ({
    nombre: 'Juan',
    dni: '30123456',
    tipo_alta: TipoAltaClienteFinal.dispositivo_compartido,
    cupos_por_categoria: 1,
    aislar_cuenta: true,
    aislamiento_dias: 30,
    dispositivo: {},
    ...extra,
  });

  it('rechaza Aislar Cuenta en una venta exclusiva', async () => {
    const { servicio } = crearServicio();

    await expect(
      servicio.crear(
        dtoAislado({
          tipo_alta: TipoAltaClienteFinal.cuenta_exclusiva,
          cupos_por_categoria: undefined,
        }) as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza días de aislamiento inválidos: 0, negativos o no enteros', async () => {
    const { servicio } = crearServicio();

    for (const dias of [0, -5, 1.5]) {
      await expect(
        servicio.crear(dtoAislado({ aislamiento_dias: dias }) as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('rechaza Aislar Cuenta sin indicar los días', async () => {
    const { servicio } = crearServicio();

    await expect(
      servicio.crear(dtoAislado({ aislamiento_dias: undefined }) as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza Aislar Cuenta sobre una Cuenta existente (cuenta_id)', async () => {
    const { servicio } = crearServicio();

    await expect(
      servicio.crear(dtoAislado({ cuenta_id: '11111111-1111-1111-1111-111111111111' }) as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crea la Cuenta y le aplica el aislamiento A NIVEL CUENTA (sin ventana)', async () => {
    const clienteCreate = jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: 'cliente-1',
        ...data,
      }));
    const cuentaUpdate = jest.fn().mockResolvedValue({});
    const registrarEnTx = jest.fn().mockResolvedValue(undefined);
    const tx = {
      clienteFinal: { create: clienteCreate },
      cuenta: { update: cuentaUpdate },
    };
    const prisma = {
      transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
      db: {},
    } as unknown as PrismaService;
    const dispositivos = {
      operadorPrincipalId: jest.fn().mockResolvedValue('operador-1'),
      alta: jest.fn().mockResolvedValue({
        cuenta: { id: 'cuenta-1' },
        cuentaCreada: true,
        pendienteDeAutoprovision: true,
        solicitudVinculacionId: 'sol-1',
      }),
    } as unknown as DispositivosService;
    const proveedor = {
      consultarLicencias: jest.fn().mockResolvedValue({ compradas: { '1': 1 }, usadas: {} }),
    } as unknown as ProveedorService;
    const contexto = {
      esOperador: false,
      empresaRevendedoraId: 'empresa-1',
    } as unknown as RequestContextService;
    const servicio = new ClientesService(
      prisma,
      { registrarEnTx, registrar: jest.fn() } as unknown as AuditService,
      {} as CryptoService,
      contexto,
      dispositivos,
      {
        siguienteNumeroCliente: jest.fn().mockResolvedValue(1),
      } as unknown as IdentificadoresService,
      proveedor,
      {} as PruebasService,
    );
    jest.spyOn(servicio, 'obtener').mockResolvedValue({ id: 'cliente-1' } as never);

    await servicio.crear(dtoAislado({ servicios: ['1'] }) as never);

    expect(dispositivos.alta).toHaveBeenCalledWith(
      expect.objectContaining({ forzarCuentaNueva: true, omitirVentanaCuriosidad: true }),
    );
    expect(cuentaUpdate).toHaveBeenCalledWith({
      where: { id: 'cuenta-1' },
      data: { aislada: true, aislamientoFinEn: expect.any(Date) },
    });
    expect(registrarEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        accion: 'apertura_aislamiento_cuenta',
        detalle: expect.objectContaining({ origen: 'alta' }),
      }),
    );
  });
});

/**
 * Editar los datos de contacto no puede dejar que un Cliente Final tome el DNI o
 * el teléfono de otro. Sólo se valida cuando el valor cambia, para no rechazar un
 * guardado sin cambios.
 */
describe('ClientesService — validación de DNI y teléfono al editar', () => {
  const actual = { idGestionExterno: null, dni: '11111111', telefono: '2615550000' };

  const crearServicio = (findFirst = jest.fn().mockResolvedValue(null)) => {
    const update = jest.fn().mockResolvedValue({ id: 'cliente-1' });
    const prisma = {
      db: {
        clienteFinal: {
          findUnique: jest.fn().mockResolvedValue(actual),
          findFirst,
          update,
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as unknown as PrismaService;
    const contexto = {
      esOperador: false,
      empresaRevendedoraId: 'empresa-1',
    } as unknown as RequestContextService;

    const servicio = new ClientesService(
      prisma,
      {} as AuditService,
      {} as CryptoService,
      contexto,
      {} as DispositivosService,
      {} as IdentificadoresService,
      {} as ProveedorService,
      {} as PruebasService,
    );
    return { servicio, findFirst, update };
  };

  it('rechaza editar con un DNI que ya tiene otro Cliente Final', async () => {
    const { servicio } = crearServicio(jest.fn().mockResolvedValue({ id: 'otro' }));

    const error = await servicio.actualizar('cliente-1', { dni: '22222222' }).catch((e) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ error: 'DniDuplicado' });
  });

  it('rechaza editar con un teléfono que ya tiene otro Cliente Final', async () => {
    const { servicio } = crearServicio(jest.fn().mockResolvedValue({ id: 'otro' }));

    const error = await servicio
      .actualizar('cliente-1', { telefono: '2615559999' })
      .catch((e) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: 'TelefonoDuplicado',
    });
  });

  it('no valida duplicados si el DNI y el teléfono no cambian', async () => {
    const { servicio, findFirst, update } = crearServicio();

    await servicio.actualizar('cliente-1', { dni: '11111111', telefono: '2615550000' });

    expect(findFirst).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  describe('alta de cuenta de prueba (HU-P03)', () => {
    const crearParaAlta = () => {
      const dispositivos = {
        operadorPrincipalId: jest.fn().mockResolvedValue('operador-1'),
      } as unknown as DispositivosService;
      const contexto = {
        esOperador: false,
        empresaRevendedoraId: 'empresa-1',
        operadorPrincipalId: 'operador-1',
        teamMemberId: 'team-1',
      } as unknown as RequestContextService;
      return new ClientesService(
        { db: {} } as unknown as PrismaService,
        {} as AuditService,
        {} as CryptoService,
        contexto,
        dispositivos,
        {} as IdentificadoresService,
        {} as ProveedorService,
        {} as PruebasService,
      );
    };

    const baseDto = () => ({
      nombre: 'Juan',
      dni: '30000026',
      tipo_alta: TipoAltaClienteFinal.dispositivo_compartido,
      cupos_por_categoria: 1 as const,
      dispositivo: {},
    });

    it('rechaza combinar una prueba con Aislar Cuenta', async () => {
      await expect(
        crearParaAlta().crear({ ...baseDto(), es_prueba: true, aislar_cuenta: true } as never),
      ).rejects.toThrow('no puede combinarse con Aislar Cuenta');
    });

    it('rechaza una prueba sobre una Cuenta existente', async () => {
      await expect(
        crearParaAlta().crear({
          ...baseDto(),
          es_prueba: true,
          cuenta_id: '11111111-1111-1111-1111-111111111111',
        } as never),
      ).rejects.toThrow('Cuenta nueva');
    });

    it('rechaza una prueba con Ventana de Alta', async () => {
      await expect(
        crearParaAlta().crear({
          ...baseDto(),
          es_prueba: true,
          duracion_ventana_curiosidad_minutos: 30,
        } as never),
      ).rejects.toThrow('no admite una Ventana de Alta');
    });
  });
});
