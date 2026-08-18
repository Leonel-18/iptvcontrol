/**
 * =============================================================================
 * Cliente HTTP del panel
 * =============================================================================
 * Un único punto de salida hacia el backend. Concentra tres cosas que si se
 * repartieran por los componentes se desincronizarían enseguida:
 *
 *  1. El token de Auth0 en cada request.
 *  2. La traducción de errores a mensajes en español listos para mostrar.
 *  3. La descarga de CSV, que es el mismo endpoint con `format=csv`
 *     (docs/IPTVControl_URL_Routing_Convention.md, sección 5.2).
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/** Proveedor del token. Lo inyecta el AuthProvider al iniciar la sesión. */
let obtenerToken: (() => Promise<string | null>) | null = null;

export const registrarProveedorDeToken = (proveedor: () => Promise<string | null>): void => {
  obtenerToken = proveedor;
};

/** Error de API con el mensaje ya listo para el usuario. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly error?: string,
    readonly payload?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** true si el proveedor de contenido está caído o congestionado. */
  get esProveedorCaido(): boolean {
    return this.status === 503 || this.error === 'ProveedorNoDisponible';
  }

  /** true si el backend avisó de un ID de gestión externa duplicado. */
  get esDuplicadoGestionExterna(): boolean {
    return this.error === 'IdGestionExternoDuplicado';
  }
}

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface Opciones {
  metodo?: Metodo;
  body?: unknown;
  /** Parámetros de consulta; los `undefined` se descartan solos. */
  params?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

const construirUrl = (ruta: string, params?: Opciones['params']): string => {
  const url = `${BASE_URL}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
  if (!params) return url;

  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === '') continue;
    query.set(clave, String(valor));
  }
  const cadena = query.toString();
  return cadena ? `${url}?${cadena}` : url;
};

const armarCabeceras = async (conCuerpo: boolean): Promise<HeadersInit> => {
  const cabeceras: Record<string, string> = { Accept: 'application/json' };
  if (conCuerpo) cabeceras['Content-Type'] = 'application/json';

  const token = obtenerToken ? await obtenerToken() : null;
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  return cabeceras;
};

/** Mensajes para los casos donde el backend no dice nada útil. */
const mensajePorEstado = (status: number): string => {
  switch (status) {
    case 401:
      return 'Su sesión expiró. Vuelva a iniciar sesión.';
    case 403:
      return 'No tiene permisos para realizar esta operación.';
    case 404:
      return 'No encontramos lo que buscaba.';
    case 429:
      return 'Demasiadas solicitudes seguidas. Espere unos segundos.';
    case 503:
      return 'Intente nuevamente más tarde, sistema congestionado, comuníquese con el operador';
    default:
      return status >= 500
        ? 'Ocurrió un error en el servidor. Intente nuevamente.'
        : 'No se pudo completar la operación.';
  }
};

export const api = async <T>(ruta: string, opciones: Opciones = {}): Promise<T> => {
  const { metodo = 'GET', body, params, signal } = opciones;

  let respuesta: Response;
  try {
    respuesta = await fetch(construirUrl(ruta, params), {
      method: metodo,
      headers: await armarCabeceras(body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (causa) {
    if ((causa as Error).name === 'AbortError') throw causa;
    // Sin red o backend caído: no hay respuesta que interpretar.
    throw new ApiError(0, 'No pudimos conectarnos con el servidor. Revise su conexión.');
  }

  if (respuesta.status === 204) return undefined as T;

  const texto = await respuesta.text();
  const datos = texto ? (JSON.parse(texto) as Record<string, unknown>) : {};

  if (!respuesta.ok) {
    const mensaje = Array.isArray(datos.message)
      ? (datos.message as string[]).join(' ')
      : ((datos.message as string) ?? mensajePorEstado(respuesta.status));

    throw new ApiError(respuesta.status, mensaje, datos.error as string, datos);
  }

  return datos as T;
};

/**
 * Descarga el listado en CSV reutilizando el endpoint y los filtros actuales.
 * No hay una ruta paralela de exportación: cambia el formato de la respuesta.
 */
export const descargarCsv = async (
  ruta: string,
  params: Opciones['params'],
  nombreArchivo: string,
): Promise<void> => {
  const respuesta = await fetch(construirUrl(ruta, { ...params, format: 'csv' }), {
    headers: await armarCabeceras(false),
  });

  if (!respuesta.ok) {
    throw new ApiError(respuesta.status, mensajePorEstado(respuesta.status));
  }

  const blob = await respuesta.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${nombreArchivo}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
};

/** Respuesta paginada estándar del backend. */
export interface Paginado<T> {
  data: T[];
  meta: { page: number; per_page: number; total: number; total_pages: number };
}
