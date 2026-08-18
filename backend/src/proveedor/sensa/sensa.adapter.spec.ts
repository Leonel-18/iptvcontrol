import { ConfigService } from '@nestjs/config';
import { SensaAdapter } from './sensa.adapter';
import { ProveedorRateLimiterService } from '../rate-limiter.service';
import { ProveedorTelemetryService } from '../proveedor-telemetry.service';
import { SENSA_CODIGOS } from './sensa.constants';
import {
  DniRepetidoError,
  EmailRepetidoError,
  ProveedorNoDisponibleError,
  ProveedorValidacionError,
} from '../../common/errors/proveedor.errors';
import { CredencialesProveedor, CrearCuentaParams } from '../proveedor-adapter.interface';

/**
 * Tests del adapter de SENSA: saneamiento de datos y traducción de códigos de
 * error. Es la frontera con el tercero, así que es donde más conviene tener red.
 */
describe('SensaAdapter', () => {
  const credenciales: CredencialesProveedor = {
    server: 'api.sensa.test',
    port: 443,
    usuario: 'usuario',
    token: 'token-secreto',
  };

  const paramsCuenta: CrearCuentaParams = {
    dni: '30000001',
    email: 'contacto1@isp.com',
    password: '1234567890',
    pin: '1234',
    nombre: 'TECNOLOGIA ACTIVA S.A.S.',
    apellido: 'Contacto',
    direccion: 'Echeverría 1776 PB',
    ciudad: 'Godoy Cruz',
    telefono: '261-575-5355',
    servicios: '1|3',
    dispositivosFijos: 1,
    dispositivosMoviles: 1,
  };

  const crearAdapter = () => {
    const config = {
      get: (ruta: string) =>
        ruta === 'sensa.requestTimeoutMs'
          ? 5000
          : ruta === 'sensa.rateLimitPerMinute'
            ? 600
            : undefined,
    } as unknown as ConfigService;

    const telemetry = { registrar: jest.fn().mockResolvedValue(undefined) };
    const adapter = new SensaAdapter(
      config,
      new ProveedorRateLimiterService(config),
      telemetry as unknown as ProveedorTelemetryService,
    );
    return { adapter, telemetry };
  };

  const responder = (cuerpo: unknown, status = 200) =>
    Promise.resolve({
      status,
      text: () => Promise.resolve(JSON.stringify(cuerpo)),
    } as Response);

  const envelope = (code: number, response: unknown = '', info = '') => ({
    code,
    code_description: 'test',
    info,
    response,
    user_facing_info: '',
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Saneamiento de datos exigido por la API
  // ---------------------------------------------------------------------------

  describe('saneamiento de datos', () => {
    it('deja el nombre en 3 a 20 caracteres alfabéticos, sin acentos ni símbolos', () => {
      // "TECNOLOGIA ACTIVA S.A.S." tiene puntos, que la API rechaza.
      const resultado = SensaAdapter.sanitizarNombre('TECNOLOGIA ACTIVA S.A.S.', 'Cuenta');
      expect(resultado).toMatch(/^[A-Za-z ]+$/);
      expect(resultado.length).toBeLessThanOrEqual(20);
      expect(resultado.length).toBeGreaterThanOrEqual(3);
    });

    it('usa el valor por defecto si no queda nada usable', () => {
      expect(SensaAdapter.sanitizarNombre('123 456', 'Cuenta')).toBe('Cuenta');
      expect(SensaAdapter.sanitizarNombre('', 'Revendedor')).toBe('Revendedor');
    });

    it('quita los acentos en lugar de descartar la letra', () => {
      expect(SensaAdapter.sanitizarNombre('Añatuya Ñandú', 'X')).toBe('Anatuya Nandu');
    });

    it('deja el teléfono en 7 a 10 dígitos, sin separadores', () => {
      expect(SensaAdapter.sanitizarTelefono('261-575-5355')).toBe('2615755355');
      // Más de 10 dígitos: se conservan los últimos 10 (número local).
      expect(SensaAdapter.sanitizarTelefono('+54 9 261 575 5355')).toHaveLength(10);
      // Menos de 7: se completa, no se traba el alta por un dato de contacto.
      expect(SensaAdapter.sanitizarTelefono('12345')).toBe('1234500');
    });

    it('normaliza la MAC a 12 hexadecimales en mayúsculas', () => {
      expect(SensaAdapter.normalizarMac('03:ac:1a:e6:0c:a7')).toBe('03AC1AE60CA7');
      expect(SensaAdapter.normalizarMac('03-AC-1A-E6-0C-A7')).toBe('03AC1AE60CA7');
    });

    it('la referencia externa queda alfanumérica y de hasta 40 caracteres', () => {
      const referencia = SensaAdapter.sanitizarReferencia(
        'a1b2-c3d4-e5f6-a7b8-c9d0e1f2a3b4-extra-largo-de-mas',
      );
      expect(referencia).toMatch(/^[A-Za-z0-9]+$/);
      expect(referencia.length).toBeLessThanOrEqual(40);
    });

    it('acota la capacidad al rango del proveedor (móviles nunca en 0)', () => {
      expect(SensaAdapter.acotarCapacidad(0, 1)).toBe(1); // móviles: mínimo 1
      expect(SensaAdapter.acotarCapacidad(0, 0)).toBe(0); // fijos: 0 permitido
      expect(SensaAdapter.acotarCapacidad(9, 0)).toBe(3); // tope 3
    });
  });

  // ---------------------------------------------------------------------------
  // Mapeo de capacidad hacia la API
  // ---------------------------------------------------------------------------

  it('mapea fijo→stationary, movil→mobile y deja los STB Linux en 0', async () => {
    const { adapter } = crearAdapter();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => responder(envelope(200, { dni: '30000001' })));

    await adapter.crearCuenta(credenciales, {
      ...paramsCuenta,
      dispositivosFijos: 2,
      dispositivosMoviles: 3,
    });

    const cuerpo = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(cuerpo.auto_provision_count_stationary).toBe(2);
    expect(cuerpo.auto_provision_count_mobile).toBe(3);
    expect(cuerpo.auto_provision_count).toBe(0);
  });

  it('arma la URL base con el esquema y puerto correctos', async () => {
    const { adapter } = crearAdapter();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => responder(envelope(200, '')));

    await adapter.probarConexion(credenciales);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.sensa.test/v4/');

    await adapter.probarConexion({ ...credenciales, port: 8443 });
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.sensa.test:8443/v4/');
  });

  it('autentica con Basic Auth y no filtra el token en la URL', async () => {
    const { adapter } = crearAdapter();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => responder(envelope(200, '')));

    await adapter.probarConexion(credenciales);

    const opciones = fetchMock.mock.calls[0][1] as RequestInit;
    const esperado = Buffer.from('usuario:token-secreto').toString('base64');
    expect((opciones.headers as Record<string, string>).Authorization).toBe(`Basic ${esperado}`);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('token-secreto');
  });

  // ---------------------------------------------------------------------------
  // Traducción de códigos de error
  // ---------------------------------------------------------------------------

  describe('traducción de errores del proveedor', () => {
    it('convierte "usuario ya existe" en DniRepetidoError para reintentar solo', async () => {
      const { adapter } = crearAdapter();
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(() => responder(envelope(SENSA_CODIGOS.USER_ALREADY_EXISTS)));

      // Este error NO se le muestra al usuario: la capa de negocio incrementa el
      // DNI y reintenta (reglas 2.3 y 5).
      await expect(adapter.crearCuenta(credenciales, paramsCuenta)).rejects.toBeInstanceOf(
        DniRepetidoError,
      );
    });

    it('trata el error crítico del middleware por usuario existente como DNI repetido', async () => {
      const { adapter } = crearAdapter();
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(() => responder(envelope(SENSA_CODIGOS.MINERVA_USER_EXISTS)));

      await expect(adapter.crearCuenta(credenciales, paramsCuenta)).rejects.toBeInstanceOf(
        DniRepetidoError,
      );
    });

    it('convierte "email ya existe" en EmailRepetidoError', async () => {
      const { adapter } = crearAdapter();
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(() => responder(envelope(SENSA_CODIGOS.EMAIL_ALREADY_EXISTS)));

      await expect(adapter.crearCuenta(credenciales, paramsCuenta)).rejects.toBeInstanceOf(
        EmailRepetidoError,
      );
    });

    it('convierte los errores de validación en ProveedorValidacionError', async () => {
      const { adapter } = crearAdapter();
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(() => responder(envelope(SENSA_CODIGOS.INVALID_CUSTOMER_ID)));

      await expect(adapter.crearCuenta(credenciales, paramsCuenta)).rejects.toBeInstanceOf(
        ProveedorValidacionError,
      );
    });

    it('devuelve el mensaje de negocio ante indisponibilidad del proveedor', async () => {
      const { adapter } = crearAdapter();
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(() => responder(envelope(SENSA_CODIGOS.SERVICE_UNAVAILABLE)));

      const error = await adapter.crearCuenta(credenciales, paramsCuenta).catch((e) => e);
      expect(error).toBeInstanceOf(ProveedorNoDisponibleError);
      // Texto textual pedido en la regla 5.
      expect((error.getResponse() as { message: string }).message).toContain(
        'sistema congestionado',
      );
    });

    it('trata una falla de red como proveedor no disponible', async () => {
      const { adapter } = crearAdapter();
      jest.spyOn(global, 'fetch').mockImplementation(() => Promise.reject(new Error('ECONNRESET')));

      await expect(adapter.probarConexion(credenciales)).resolves.toMatchObject({ ok: false });
    });

    it('registra la traza de cada llamada para el panel de salud', async () => {
      const { adapter, telemetry } = crearAdapter();
      jest.spyOn(global, 'fetch').mockImplementation(() => responder(envelope(200, '')));

      await adapter.probarConexion(credenciales);

      expect(telemetry.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ operacion: 'test_api', estado: 'exitosa' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Idempotencia
  // ---------------------------------------------------------------------------

  describe('idempotencia de las bajas', () => {
    it('no falla si el dispositivo ya no existe en el proveedor', async () => {
      const { adapter } = crearAdapter();
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(() => responder(envelope(SENSA_CODIGOS.DEVICE_DOES_NOT_EXIST)));

      // El objetivo de la baja (que no exista) ya está cumplido.
      await expect(adapter.eliminarDispositivo(credenciales, '830792')).resolves.toBeUndefined();
    });

    it('no falla si la Cuenta ya no existe al cerrarla', async () => {
      const { adapter } = crearAdapter();
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(() => responder(envelope(SENSA_CODIGOS.USER_DOES_NOT_EXIST)));

      await expect(adapter.cerrarCuenta(credenciales, '30000001')).resolves.toBeUndefined();
    });

    it('devuelve null al consultar una Cuenta inexistente', async () => {
      const { adapter } = crearAdapter();
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(() => responder(envelope(SENSA_CODIGOS.USER_DOES_NOT_EXIST)));

      await expect(adapter.consultarCuenta(credenciales, '30000001')).resolves.toBeNull();
    });

    it('tolera que la capacidad ya estuviera en el valor pedido (código 820)', async () => {
      const { adapter } = crearAdapter();
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(() => responder(envelope(SENSA_CODIGOS.USER_DATA_WAS_NOT_MODIFIED)));

      await expect(
        adapter.actualizarCapacidadDispositivos(credenciales, {
          proveedorCuentaId: '30000001',
          dispositivosFijos: 1,
          dispositivosMoviles: 1,
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Alta de Dispositivo
  // ---------------------------------------------------------------------------

  describe('activarDispositivo', () => {
    it('sin MAC no llama al proveedor: espera la auto-provisión', async () => {
      const { adapter } = crearAdapter();
      const fetchMock = jest.spyOn(global, 'fetch');

      const resultado = await adapter.activarDispositivo(credenciales, {
        proveedorCuentaId: '30000001',
      });

      expect(resultado).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('con MAC crea el dispositivo y captura el ID que devuelve el proveedor', async () => {
      const { adapter } = crearAdapter();
      jest.spyOn(global, 'fetch').mockImplementation(() =>
        responder(
          envelope(200, {
            customer_id: '30000001',
            device: { device_id: 830792, mac: '03AC1AE60CA7', device_type: 'phone', status: 'A' },
          }),
        ),
      );

      const resultado = await adapter.activarDispositivo(credenciales, {
        proveedorCuentaId: '30000001',
        mac: '03:AC:1A:E6:0C:A7',
      });

      expect(resultado).toMatchObject({ proveedorDeviceId: '830792', activo: true });
    });

    it('si el dispositivo ya existía, lo reasigna a esta Cuenta', async () => {
      const { adapter } = crearAdapter();
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockImplementationOnce(() => responder(envelope(SENSA_CODIGOS.DEVICE_ALREADY_EXISTS)))
        .mockImplementationOnce(() =>
          responder(envelope(200, { customer_id: '30000001', device: { device_id: 830792 } })),
        );

      const resultado = await adapter.activarDispositivo(credenciales, {
        proveedorCuentaId: '30000001',
        mac: '03AC1AE60CA7',
      });

      expect(resultado?.proveedorDeviceId).toBe('830792');
      // La segunda llamada es el PUT de Assign Device.
      expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('PUT');
    });
  });
});
