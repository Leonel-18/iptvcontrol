import { EstadoClienteFinal, EstadoDispositivo, TipoAltaClienteFinal } from '@prisma/client';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { DispositivosService } from '../dispositivos/dispositivos.service';
import { IdentificadoresService } from '../cuentas/identificadores.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
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
      db: { clienteFinal: { findMany, count } },
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
