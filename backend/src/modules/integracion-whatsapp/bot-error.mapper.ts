import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';
import {
  DniRepetidoError,
  EmailRepetidoError,
  ProveedorAutenticacionError,
  ProveedorNoDisponibleError,
  ProveedorValidacionError,
  ReintentosDniAgotadosError,
} from '../../common/errors/proveedor.errors';

/** Categorías de error que el bot de WhatsApp sabe comunicar. */
export type CodigoErrorBot =
  | 'ACCOUNT_ALREADY_EXISTS'
  | 'INVALID_DATA'
  | 'PROVIDER_AUTH'
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ErrorBotMapeado {
  code: CodigoErrorBot;
  /** Texto seguro para el Cliente Final. Nunca incluye detalle técnico. */
  mensajeUsuario: string;
  /** Detalle para los logs internos. */
  detalle: string;
  nivelLog: 'warn' | 'error';
}

/**
 * Mensajes que ve el Cliente Final por WhatsApp. Son deliberadamente genéricos:
 * no exponen códigos de SENSA, SQL, credenciales ni stack traces.
 */
export const MENSAJES_ERROR_BOT: Record<CodigoErrorBot, string> = {
  ACCOUNT_ALREADY_EXISTS: 'Ya existe una cuenta registrada para este servicio.',
  INVALID_DATA: 'Los datos enviados no son válidos o están incompletos.',
  PROVIDER_AUTH: 'No pudimos conectarnos con el servicio de IPTV.',
  PROVIDER_UNAVAILABLE: 'El servicio de IPTV está demorando más de lo normal.',
  RATE_LIMITED: 'Estamos recibiendo muchas solicitudes en este momento.',
  INTERNAL_ERROR: 'No pudimos procesar la solicitud.',
};

/**
 * Traduce cualquier excepción del alta del bot a una categoría + mensaje.
 *
 * Orden importa: los errores del proveedor y los de negocio se evalúan antes que
 * los genéricos de Nest, para no perderlos en la categoría "inesperado".
 */
export function mapearErrorBot(exception: unknown): ErrorBotMapeado {
  const detalle = exception instanceof Error ? exception.message : String(exception);

  // Cuenta ya existente en el Proveedor (exclusiva: DNI o correo reales ya usados).
  if (esErrorDeRespuesta(exception, 'CuentaDuplicadaEnProveedor')) {
    return conCodigo('ACCOUNT_ALREADY_EXISTS', detalle, 'warn');
  }

  // Duplicado local del ID de gestión externo del CRM (regla 2.5).
  if (esErrorDeRespuesta(exception, 'IdGestionExternoDuplicado')) {
    return conCodigo('ACCOUNT_ALREADY_EXISTS', detalle, 'warn');
  }

  if (exception instanceof DniRepetidoError || exception instanceof EmailRepetidoError) {
    return conCodigo('ACCOUNT_ALREADY_EXISTS', detalle, 'warn');
  }

  if (exception instanceof ProveedorAutenticacionError) {
    return conCodigo('PROVIDER_AUTH', detalle, 'error');
  }

  if (
    exception instanceof ProveedorNoDisponibleError ||
    exception instanceof ReintentosDniAgotadosError
  ) {
    return conCodigo('PROVIDER_UNAVAILABLE', detalle, 'warn');
  }

  if (exception instanceof ProveedorValidacionError) {
    return conCodigo('INVALID_DATA', detalle, 'warn');
  }

  if (exception instanceof BadRequestException) {
    return conCodigo('INVALID_DATA', detalle, 'warn');
  }

  if (exception instanceof ConflictException) {
    return conCodigo('ACCOUNT_ALREADY_EXISTS', detalle, 'warn');
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    if (status === 429) return conCodigo('RATE_LIMITED', detalle, 'warn');
    if (status >= 500) return conCodigo('PROVIDER_UNAVAILABLE', detalle, 'warn');
    return conCodigo('INVALID_DATA', detalle, 'warn');
  }

  // Cualquier otra cosa (bug, error de base, etc.): genérico y se loguea como error.
  return conCodigo('INTERNAL_ERROR', detalle, 'error');
}

function conCodigo(
  code: CodigoErrorBot,
  detalle: string,
  nivelLog: 'warn' | 'error',
): ErrorBotMapeado {
  return { code, mensajeUsuario: MENSAJES_ERROR_BOT[code], detalle, nivelLog };
}

/** true si la excepción es un HttpException con un `error` de negocio concreto. */
function esErrorDeRespuesta(exception: unknown, codigoNegocio: string): boolean {
  if (!(exception instanceof HttpException)) return false;
  const payload = exception.getResponse();
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as { error?: string }).error === codigoNegocio
  );
}
