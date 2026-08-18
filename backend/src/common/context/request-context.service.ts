import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { RolTeamMember } from '@prisma/client';

/**
 * Identidad resuelta del request, disponible en cualquier punto del stack sin
 * tener que ir pasando el `request` de servicio en servicio.
 */
export interface RequestContext {
  /** id del TeamMember en IPTVControl. */
  teamMemberId?: string;
  auth0UserId?: string;
  email?: string;
  rol?: RolTeamMember;
  /** Tenant: Empresa Revendedora (null si el Team Member es del Operador). */
  empresaRevendedoraId?: string | null;
  /** Operador Principal al que pertenece el request. */
  operadorPrincipalId?: string | null;
  /** true si el Team Member es del Operador Principal. */
  esOperador: boolean;
  /** Correlación de logs y de la traza de llamadas al Proveedor. */
  requestId?: string;
}

/**
 * Contexto de request basado en AsyncLocalStorage.
 *
 * Se inicializa en un middleware de Express (ver RequestContextMiddleware), que
 * envuelve toda la cadena posterior — guards, interceptores y handler — dentro
 * del mismo contexto asincrónico. Ese detalle importa: si se inicializara en un
 * interceptor de NestJS, el handler correría fuera del scope y el contexto
 * llegaría vacío.
 *
 * De acá lo toma PrismaService para setear `app.current_tenant` en cada
 * transacción y que las políticas de Row-Level Security apliquen solas.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  /** Ejecuta `callback` dentro de un contexto nuevo. */
  run<T>(inicial: RequestContext, callback: () => T): T {
    return this.storage.run(inicial, callback);
  }

  /** Contexto actual, o undefined si estamos fuera de un request (ej. un job). */
  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Completa el contexto actual. Se usa desde el guard de autenticación, una
   * vez que ya se resolvió qué Team Member es el dueño del token.
   */
  set(parcial: Partial<RequestContext>): void {
    const actual = this.storage.getStore();
    if (!actual) return;
    Object.assign(actual, parcial);
  }

  /** Tenant activo (Empresa Revendedora) o null si es el Operador Principal. */
  get empresaRevendedoraId(): string | null {
    return this.get()?.empresaRevendedoraId ?? null;
  }

  get operadorPrincipalId(): string | null {
    return this.get()?.operadorPrincipalId ?? null;
  }

  get esOperador(): boolean {
    return this.get()?.esOperador ?? false;
  }

  get teamMemberId(): string | undefined {
    return this.get()?.teamMemberId;
  }
}
