import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoLlamadaProveedor } from '@prisma/client';
import {
  ActivarDispositivoParams,
  ActualizarCapacidadParams,
  ActualizarPasswordParams,
  ActualizarServiciosParams,
  CredencialesProveedor,
  CrearCuentaParams,
  CuentaProveedor,
  CuentaInventarioProveedor,
  DispositivoProveedor,
  LicenciasProveedor,
  ProveedorAdapter,
  ResultadoPrueba,
  ServiciosCuenta,
} from '../proveedor-adapter.interface';
import { ProveedorRateLimiterService } from '../rate-limiter.service';
import { ProveedorTelemetryService } from '../proveedor-telemetry.service';
import {
  DniRepetidoError,
  EmailRepetidoError,
  ProveedorNoDisponibleError,
  ProveedorValidacionError,
} from '../../common/errors/proveedor.errors';
import {
  CODIGOS_DNI_REPETIDO,
  CODIGOS_EMAIL_REPETIDO,
  CODIGOS_VALIDACION,
  CONECTOR_SENSA,
  SENSA_CODIGOS,
} from './sensa.constants';
import {
  SensaAddUserRequest,
  SensaCreateDeviceRequest,
  SensaDevice,
  SensaDeviceEnvelopeResponse,
  SensaEditUserRequest,
  SensaEnvelope,
  SensaLicensesResponse,
  SensaUser,
  SensaUsersResponse,
  SensaUserServicesResponse,
} from './sensa.types';

interface OpcionesLlamada {
  operacion: string;
  metodo: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  ruta: string;
  body?: unknown;
  /** Códigos que NO se consideran error para esta llamada puntual. */
  codigosTolerados?: number[];
  operadorPrincipalId?: string | null;
}

/**
 * =============================================================================
 * SensaAdapter — única implementación de ProveedorAdapter en el MVP
 * =============================================================================
 * Traduce el vocabulario de IPTVControl al de la API de SENSA v4.1.3:
 *
 *   Cuenta                    → "user" de SENSA (identificado por dni/customer_id)
 *   Capacidad comercial global → se proyecta sobre los tres contadores técnicos
 *                                 y se protege con reservas de Dispositivo.
 *
 * Nada de esta traducción debe filtrarse hacia la lógica de negocio: si mañana
 * aparece otro Proveedor, este archivo es el único que se reemplaza.
 *
 * Nota sobre tipos: el PDF de SENSA documenta `auto_provision_count*` como
 * "int", pero la API real los valida como string — un número JSON sin
 * comillas se rechaza con código 707 ("Invalid format"), sin importar el
 * valor. Por eso estos tres campos se mandan siempre con `String(...)`.
 * =============================================================================
 */
@Injectable()
export class SensaAdapter implements ProveedorAdapter {
  readonly tipoConector = CONECTOR_SENSA;
  private readonly logger = new Logger(SensaAdapter.name);
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    private readonly rateLimiter: ProveedorRateLimiterService,
    private readonly telemetry: ProveedorTelemetryService,
  ) {
    this.timeoutMs = config.get<number>('sensa.requestTimeoutMs') ?? 15000;
  }

  // ---------------------------------------------------------------------------
  // Información general
  // ---------------------------------------------------------------------------

  /**
   * Método "Test API" (GET /v4/). Se ejecuta siempre server-side: exponer esto
   * al navegador implicaría mandarle el token al cliente, que es justamente lo
   * que la restricción de seguridad de docs/04 sección 9.2 prohíbe.
   */
  async probarConexion(credenciales: CredencialesProveedor): Promise<ResultadoPrueba> {
    const inicio = Date.now();
    try {
      const envelope = await this.llamar<string>(credenciales, {
        operacion: 'test_api',
        metodo: 'GET',
        ruta: '/v4/',
      });
      return {
        ok: true,
        mensaje: envelope.user_facing_info || envelope.info || 'La API del proveedor responde.',
        latenciaMs: Date.now() - inicio,
        codigo: envelope.code,
      };
    } catch (error) {
      return {
        ok: false,
        mensaje: this.mensajeUsuarioDeError(error),
        latenciaMs: Date.now() - inicio,
        codigo: (error as { codigoProveedor?: number }).codigoProveedor,
      };
    }
  }

  async consultarLicencias(credenciales: CredencialesProveedor): Promise<LicenciasProveedor> {
    const envelope = await this.llamar<SensaLicensesResponse>(credenciales, {
      operacion: 'get_licenses',
      metodo: 'GET',
      ruta: '/v4/licenses/',
    });
    return {
      compradas: envelope.response?.service_packages_bought ?? {},
      usadas: envelope.response?.service_packages_used ?? {},
    };
  }

  // ---------------------------------------------------------------------------
  // Cuentas (usuarios de SENSA)
  // ---------------------------------------------------------------------------

  async listarCuentas(credenciales: CredencialesProveedor): Promise<CuentaInventarioProveedor[]> {
    const cuentas: CuentaInventarioProveedor[] = [];
    let pagina = 1;
    let totalPaginas = 1;

    do {
      const envelope = await this.llamar<SensaUsersResponse>(credenciales, {
        operacion: 'get_users',
        metodo: 'GET',
        ruta: `/v4/users?page=${pagina}&per_page=100&is_hotel=false`,
      });
      const respuesta = envelope.response;
      const usuarios = respuesta?.users ?? [];

      cuentas.push(...usuarios.map((usuario) => this.mapearCuentaInventario(usuario)));
      totalPaginas = Math.max(1, Number(respuesta?.total_pages) || 1);
      pagina += 1;
    } while (pagina <= totalPaginas);

    return cuentas;
  }

  async crearCuenta(
    credenciales: CredencialesProveedor,
    params: CrearCuentaParams,
  ): Promise<CuentaProveedor> {
    const body: SensaAddUserRequest = {
      first_name: SensaAdapter.sanitizarNombre(params.nombre, 'Cuenta'),
      last_name: SensaAdapter.sanitizarNombre(params.apellido, 'Revendedor'),
      dni: params.dni,
      email: params.email,
      mobile_phone: SensaAdapter.sanitizarTelefono(params.telefono),
      address: SensaAdapter.sanitizarAlfanumerico(params.direccion, 'Sin direccion'),
      city: SensaAdapter.sanitizarAlfanumerico(params.ciudad, 'Sin ciudad').slice(0, 80),
      password: params.password,
      pin: params.pin,
      services: params.servicios,
      // IPTVControl aplica un máximo comercial global. Hasta validar en la
      // Cuenta de prueba cuál de los tres contadores consume cada cliente,
      // se proyecta el mismo límite a las categorías de SENSA y se bloquea la
      // capacidad no vendida mediante reservas técnicas.
      auto_provision_count: String(SensaAdapter.acotarCapacidad(params.limiteDispositivos, 1)),
      auto_provision_count_mobile: String(
        SensaAdapter.acotarCapacidad(params.limiteDispositivos, 1),
      ),
      auto_provision_count_stationary: String(
        SensaAdapter.acotarCapacidad(params.limiteDispositivos, 1),
      ),
      status: 'A',
    };

    if (params.referenciaExterna) {
      body.external_customer_id = SensaAdapter.sanitizarReferencia(params.referenciaExterna);
    }

    const envelope = await this.llamar<SensaUser>(credenciales, {
      operacion: 'add_user',
      metodo: 'POST',
      ruta: '/v4/user/',
      body,
    });

    return this.mapearCuenta(envelope.response, params);
  }

  async actualizarCapacidadDispositivos(
    credenciales: CredencialesProveedor,
    params: ActualizarCapacidadParams,
  ): Promise<void> {
    const limite = params.limiteDispositivos;
    const body: SensaEditUserRequest = {
      // String por el mismo motivo que en crearCuenta: SENSA rechaza estos
      // campos con código 707 si llegan como número JSON sin comillas.
      auto_provision_count_mobile: String(
        SensaAdapter.acotarCapacidad(params.dispositivosMoviles, 1),
      ),
      auto_provision_count_stationary: String(
        SensaAdapter.acotarCapacidad(params.dispositivosFijos, 0),
      ),
      ...(limite === undefined
        ? {}
        : { auto_provision_count: String(SensaAdapter.acotarCapacidad(limite, 1)) }),
    };

    await this.llamar<SensaUser>(credenciales, {
      operacion: 'edit_user_capacidad',
      metodo: 'PATCH',
      ruta: `/v4/user/${encodeURIComponent(params.proveedorCuentaId)}`,
      body,
      // 820: "user data was not modified". Si la capacidad ya estaba en ese
      // valor, para IPTVControl el resultado deseado igual se cumplió.
      codigosTolerados: [SENSA_CODIGOS.USER_DATA_WAS_NOT_MODIFIED],
    });
  }

  async actualizarPassword(
    credenciales: CredencialesProveedor,
    params: ActualizarPasswordParams,
  ): Promise<void> {
    const body: SensaEditUserRequest = { password: params.password };

    await this.llamar<SensaUser>(credenciales, {
      operacion: 'edit_user_password',
      metodo: 'PATCH',
      ruta: `/v4/user/${encodeURIComponent(params.proveedorCuentaId)}`,
      body,
      // 820: "user data was not modified" — si ya tenía esa misma contraseña,
      // para IPTVControl el resultado deseado igual se cumplió.
      codigosTolerados: [SENSA_CODIGOS.USER_DATA_WAS_NOT_MODIFIED],
    });
  }

  async actualizarServicios(
    credenciales: CredencialesProveedor,
    params: ActualizarServiciosParams,
  ): Promise<void> {
    const body: SensaEditUserRequest = { services: params.servicios };

    await this.llamar<SensaUser>(credenciales, {
      operacion: 'edit_user_services',
      metodo: 'PATCH',
      ruta: `/v4/user/${encodeURIComponent(params.proveedorCuentaId)}`,
      body,
      // 820: "user data was not modified" — si ya tenía esos mismos servicios,
      // para IPTVControl el resultado deseado igual se cumplió.
      codigosTolerados: [SENSA_CODIGOS.USER_DATA_WAS_NOT_MODIFIED],
    });
  }

  async consultarCuenta(
    credenciales: CredencialesProveedor,
    proveedorCuentaId: string,
  ): Promise<CuentaProveedor | null> {
    const envelope = await this.llamar<SensaUser>(credenciales, {
      operacion: 'get_user',
      metodo: 'GET',
      ruta: `/v4/user/${encodeURIComponent(proveedorCuentaId)}`,
      codigosTolerados: [SENSA_CODIGOS.USER_DOES_NOT_EXIST],
    });

    if (envelope.code === SENSA_CODIGOS.USER_DOES_NOT_EXIST || !envelope.response) {
      return null;
    }
    return this.mapearCuenta(envelope.response);
  }

  async consultarServicios(
    credenciales: CredencialesProveedor,
    proveedorCuentaId: string,
  ): Promise<ServiciosCuenta> {
    const envelope = await this.llamar<SensaUserServicesResponse>(credenciales, {
      operacion: 'get_user_services',
      metodo: 'GET',
      ruta: `/v4/user_services/${encodeURIComponent(proveedorCuentaId)}`,
    });
    return {
      plan: envelope.response?.plan ?? '',
      servicios: envelope.response?.services ?? '',
    };
  }

  async cerrarCuenta(
    credenciales: CredencialesProveedor,
    proveedorCuentaId: string,
  ): Promise<void> {
    await this.llamar<unknown>(credenciales, {
      operacion: 'delete_user',
      metodo: 'DELETE',
      ruta: `/v4/user/${encodeURIComponent(proveedorCuentaId)}`,
      // Si ya no existe en SENSA, el objetivo (que no exista) está cumplido.
      codigosTolerados: [SENSA_CODIGOS.USER_DOES_NOT_EXIST],
    });
  }

  // ---------------------------------------------------------------------------
  // Dispositivos
  // ---------------------------------------------------------------------------

  /**
   * Alta de Dispositivo.
   *
   * Dos escenarios, según la API de SENSA:
   *  a) La Empresa Revendedora conoce la MAC del equipo → se crea explícitamente
   *     con Create Device y SENSA devuelve el `device_id` en el acto.
   *  b) No hay MAC → el equipo se auto-provisiona cuando el Cliente Final
   *     inicia sesión, dentro del cupo habilitado en la Cuenta. En ese caso se
   *     devuelve null y el `proveedor_device_id` se captura después por polling
   *     (la API de SENSA no tiene webhooks).
   */
  async activarDispositivo(
    credenciales: CredencialesProveedor,
    params: ActivarDispositivoParams,
  ): Promise<DispositivoProveedor | null> {
    if (!params.mac) {
      this.logger.log(
        `Alta de Dispositivo sin MAC en la Cuenta ${params.proveedorCuentaId}: queda a la espera ` +
          'de auto-provisión; el ID del Proveedor se captura por polling.',
      );
      return null;
    }

    const body: SensaCreateDeviceRequest = {
      customer_id: params.proveedorCuentaId,
      mac: SensaAdapter.normalizarMac(params.mac),
    };

    const envelope = await this.llamar<SensaDeviceEnvelopeResponse>(credenciales, {
      operacion: 'create_device',
      metodo: 'POST',
      ruta: '/v4/device',
      body,
      codigosTolerados: [SENSA_CODIGOS.DEVICE_ALREADY_EXISTS],
    });

    // Si el dispositivo ya existía, se reasigna a esta Cuenta.
    if (envelope.code === SENSA_CODIGOS.DEVICE_ALREADY_EXISTS) {
      return this.reasignarDispositivo(credenciales, {
        mac: body.mac,
        proveedorCuentaId: params.proveedorCuentaId,
      });
    }

    return this.mapearDispositivo(envelope.response?.device);
  }

  async reasignarDispositivo(
    credenciales: CredencialesProveedor,
    params: { mac: string; proveedorCuentaId: string },
  ): Promise<DispositivoProveedor> {
    const envelope = await this.llamar<SensaDeviceEnvelopeResponse>(credenciales, {
      operacion: 'assign_device',
      metodo: 'PUT',
      ruta: '/v4/device',
      body: {
        customer_id: params.proveedorCuentaId,
        mac: SensaAdapter.normalizarMac(params.mac),
      },
      codigosTolerados: [SENSA_CODIGOS.DEVICE_ALREADY_ASSIGNED_TO_USER],
    });

    const dispositivo = this.mapearDispositivo(envelope.response?.device);
    if (!dispositivo) {
      throw new ProveedorValidacionError(
        `SENSA no devolvió datos del dispositivo al asignar la MAC ${params.mac}.`,
        envelope.code,
      );
    }
    return dispositivo;
  }

  async eliminarDispositivo(
    credenciales: CredencialesProveedor,
    proveedorDeviceId: string,
  ): Promise<void> {
    await this.llamar<SensaDevice>(credenciales, {
      operacion: 'delete_device',
      metodo: 'DELETE',
      ruta: `/v4/device/${encodeURIComponent(proveedorDeviceId)}`,
      // Idempotencia: si el dispositivo ya no está, la baja está cumplida.
      codigosTolerados: [SENSA_CODIGOS.DEVICE_DOES_NOT_EXIST],
    });
  }

  async listarDispositivos(
    credenciales: CredencialesProveedor,
    proveedorCuentaId: string,
  ): Promise<DispositivoProveedor[]> {
    const envelope = await this.llamar<SensaDevice[]>(credenciales, {
      operacion: 'get_user_devices',
      metodo: 'GET',
      ruta: `/v4/user_devices/${encodeURIComponent(proveedorCuentaId)}`,
      codigosTolerados: [SENSA_CODIGOS.USER_DOES_NOT_EXIST],
    });

    const lista = Array.isArray(envelope.response) ? envelope.response : [];
    return lista
      .map((device) => this.mapearDispositivo(device))
      .filter((device): device is DispositivoProveedor => device !== null);
  }

  // ---------------------------------------------------------------------------
  // Infraestructura HTTP
  // ---------------------------------------------------------------------------

  /**
   * Ejecuta una llamada a SENSA con Basic Auth, rate limiting, timeout y traza.
   *
   * Toda la traducción de errores pasa por acá, para que ningún módulo de
   * negocio tenga que interpretar códigos numéricos de un tercero.
   */
  private async llamar<T>(
    credenciales: CredencialesProveedor,
    opciones: OpcionesLlamada,
  ): Promise<SensaEnvelope<T>> {
    const url = this.construirUrl(credenciales, opciones.ruta);
    const inicio = Date.now();

    const ejecutar = async (): Promise<SensaEnvelope<T>> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const respuesta = await fetch(url, {
          method: opciones.metodo,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(`${credenciales.usuario}:${credenciales.token}`).toString('base64')}`,
          },
          body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
          signal: controller.signal,
        });

        const texto = await respuesta.text();
        const envelope = this.parsearEnvelope<T>(texto, respuesta.status);
        const codigo = envelope.code ?? respuesta.status;
        const tolerado = opciones.codigosTolerados?.includes(codigo) ?? false;
        const exitoso =
          codigo === SENSA_CODIGOS.SUCCESS || codigo === SENSA_CODIGOS.CREATED || tolerado;

        await this.telemetry.registrar({
          operacion: opciones.operacion,
          metodo: opciones.metodo,
          ruta: opciones.ruta,
          estado: exitoso ? EstadoLlamadaProveedor.exitosa : EstadoLlamadaProveedor.fallida,
          codigo,
          duracionMs: Date.now() - inicio,
          mensaje: exitoso ? undefined : envelope.info || envelope.code_description,
          operadorPrincipalId: opciones.operadorPrincipalId,
        });

        if (!exitoso) {
          throw this.traducirCodigo(codigo, envelope, opciones);
        }

        return { ...envelope, code: codigo };
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      return await this.rateLimiter.ejecutar(ejecutar);
    } catch (error) {
      // Los errores ya traducidos se propagan tal cual.
      if (
        error instanceof DniRepetidoError ||
        error instanceof EmailRepetidoError ||
        error instanceof ProveedorValidacionError ||
        error instanceof ProveedorNoDisponibleError
      ) {
        throw error;
      }

      // Acá caen las fallas de red, DNS y timeouts: el Proveedor no responde.
      const detalle = error instanceof Error ? error.message : String(error);
      await this.telemetry.registrar({
        operacion: opciones.operacion,
        metodo: opciones.metodo,
        ruta: opciones.ruta,
        estado: EstadoLlamadaProveedor.fallida,
        duracionMs: Date.now() - inicio,
        mensaje: detalle,
        operadorPrincipalId: opciones.operadorPrincipalId,
      });
      throw new ProveedorNoDisponibleError(detalle, opciones.operacion);
    }
  }

  private construirUrl(credenciales: CredencialesProveedor, ruta: string): string {
    const esquema = credenciales.port === 80 ? 'http' : 'https';
    const host = credenciales.server.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const puerto =
      credenciales.port === 443 || credenciales.port === 80 ? '' : `:${credenciales.port}`;
    return `${esquema}://${host}${puerto}${ruta}`;
  }

  private parsearEnvelope<T>(texto: string, statusHttp: number): SensaEnvelope<T> {
    try {
      const json = JSON.parse(texto) as SensaEnvelope<T>;
      if (typeof json?.code === 'number') return json;
      return {
        code: statusHttp,
        code_description: 'Respuesta sin código estructurado',
        info: typeof texto === 'string' ? texto.slice(0, 300) : '',
        response: json as T,
        user_facing_info: '',
      };
    } catch {
      return {
        code: statusHttp,
        code_description: 'Respuesta no JSON',
        info: texto.slice(0, 300),
        response: undefined as unknown as T,
        user_facing_info: '',
      };
    }
  }

  private traducirCodigo<T>(
    codigo: number,
    envelope: SensaEnvelope<T>,
    opciones: OpcionesLlamada,
  ): Error {
    const detalle = `[${opciones.operacion}] SENSA ${codigo}: ${envelope.info || envelope.code_description}`;

    if (CODIGOS_DNI_REPETIDO.includes(codigo)) {
      const dni = (opciones.body as SensaAddUserRequest | undefined)?.dni ?? '';
      return new DniRepetidoError(dni);
    }

    if (CODIGOS_EMAIL_REPETIDO.includes(codigo)) {
      const email = (opciones.body as SensaAddUserRequest | undefined)?.email ?? '';
      return new EmailRepetidoError(email);
    }

    if (CODIGOS_VALIDACION.includes(codigo)) {
      return new ProveedorValidacionError(detalle, codigo, envelope.user_facing_info || undefined);
    }

    if (
      codigo === SENSA_CODIGOS.USER_DOES_NOT_EXIST ||
      codigo === SENSA_CODIGOS.DEVICE_DOES_NOT_EXIST ||
      codigo === SENSA_CODIGOS.USER_DOES_NOT_BELONG
    ) {
      return new ProveedorValidacionError(
        detalle,
        codigo,
        'El recurso ya no existe en el proveedor o no pertenece a esta cuenta.',
      );
    }

    // Autenticación, indisponibilidad y errores críticos del middleware: el
    // usuario no puede hacer nada, así que se muestra el mensaje de negocio y
    // el detalle queda para el panel de salud del Operador Principal.
    return new ProveedorNoDisponibleError(detalle, opciones.operacion, codigo);
  }

  private mensajeUsuarioDeError(error: unknown): string {
    if (error instanceof ProveedorValidacionError || error instanceof ProveedorNoDisponibleError) {
      const payload = error.getResponse() as { message?: string };
      return payload.message ?? error.message;
    }
    return error instanceof Error ? error.message : String(error);
  }

  // ---------------------------------------------------------------------------
  // Mapeos SENSA → glosario IPTVControl
  // ---------------------------------------------------------------------------

  private mapearCuenta(user?: SensaUser, params?: CrearCuentaParams): CuentaProveedor {
    const estado = Array.isArray(user?.status) ? user?.status[0] : user?.status;
    return {
      proveedorCuentaId: String(user?.dni ?? params?.dni ?? ''),
      dni: String(user?.dni ?? params?.dni ?? ''),
      email: user?.email ?? params?.email ?? '',
      servicios: user?.services ?? params?.servicios ?? '',
      // SENSA puede devolver los contadores como string o número; se coerciosa
      // a número porque la capa de negocio los persiste como Int.
      dispositivosFijos: Number(
        user?.auto_provision_count_stationary ?? params?.dispositivosFijos ?? 0,
      ),
      dispositivosMoviles: Number(
        user?.auto_provision_count_mobile ?? params?.dispositivosMoviles ?? 0,
      ),
      activa: estado !== 'I',
    };
  }

  private mapearCuentaInventario(user: SensaUser): CuentaInventarioProveedor {
    const estado = Array.isArray(user.status) ? user.status[0] : user.status;
    return {
      proveedorCuentaId: String(user.dni),
      dni: String(user.dni),
      nombre: user.first_name,
      apellido: user.last_name,
      email: user.email,
      ciudad: user.city,
      referenciaExterna: user.external_customer_id ?? undefined,
      pin: user.pin === undefined || user.pin === null ? undefined : String(user.pin),
      servicios: user.services ?? '1',
      dispositivosFijos: Number(user.auto_provision_count_stationary ?? 0),
      dispositivosMoviles: Number(user.auto_provision_count_mobile ?? 0),
      fechaAlta: user.start_date || undefined,
      fechaBaja: user.end_date || undefined,
      activa: estado !== 'I',
    };
  }

  private mapearDispositivo(device?: SensaDevice): DispositivoProveedor | null {
    if (!device || device.device_id === undefined || device.device_id === null) return null;
    return {
      proveedorDeviceId: String(device.device_id),
      mac: device.mac,
      nombre: device.name,
      modelo: device.model,
      tipo: device.device_type,
      activo: (device.status ?? 'A') !== 'I',
      ultimoInicio: device.turn_on_date,
    };
  }

  // ---------------------------------------------------------------------------
  // Saneamiento de datos exigido por la API de SENSA
  // ---------------------------------------------------------------------------

  /**
   * `first_name` / `last_name` admiten entre 3 y 20 caracteres alfabéticos y
   * espacios. Los datos que mandamos son de la Empresa Revendedora (la Cuenta es
   * suya, no del Cliente Final), así que hay que limpiar dígitos y símbolos que
   * la razón social suele traer (S.A.S., guiones, etc.).
   */
  static sanitizarNombre(valor: string, fallback: string): string {
    const limpio = (valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 20)
      .trim();
    return limpio.length >= 3 ? limpio : fallback;
  }

  static sanitizarAlfanumerico(valor: string, fallback: string): string {
    const limpio = (valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return limpio.length > 0 ? limpio : fallback;
  }

  /** `mobile_phone`: entre 7 y 10 dígitos, sin espacios. */
  static sanitizarTelefono(valor: string): string {
    const digitos = (valor ?? '').replace(/\D/g, '');
    if (digitos.length > 10) return digitos.slice(-10);
    if (digitos.length >= 7) return digitos;
    // Si la Empresa Revendedora cargó un teléfono corto, se completa para no
    // trabar el alta por un dato que SENSA sólo usa como contacto.
    return digitos.padEnd(7, '0');
  }

  /** `external_customer_id`: hasta 40 alfanuméricos, sin espacios ni símbolos. */
  static sanitizarReferencia(valor: string): string {
    return (valor ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  }

  /** MAC: 12 dígitos hexadecimales en mayúsculas, sin separadores. */
  static normalizarMac(valor: string): string {
    return (valor ?? '')
      .replace(/[^0-9a-fA-F]/g, '')
      .toUpperCase()
      .slice(0, 12);
  }

  /** Acota la capacidad al rango que admite SENSA (mínimo 1 para móviles). */
  static acotarCapacidad(valor: number, minimo: number): number {
    const entero = Number.isFinite(valor) ? Math.trunc(valor) : minimo;
    return Math.min(3, Math.max(minimo, entero));
  }
}
