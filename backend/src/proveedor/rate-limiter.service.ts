import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Limitador de llamadas salientes hacia la API del Proveedor.
 *
 * Está pedido explícitamente en el stack ("rate limiting: sí, contra la API de
 * SENSA" — docs/01). La idea es la de un "balde de fichas": el balde arranca
 * lleno, cada llamada consume una ficha, y las fichas se reponen a ritmo
 * constante. Si el balde queda vacío, la llamada espera en lugar de reventar la
 * API del Proveedor — que es un tercero compartido con otras asociadas.
 *
 * Alcance: es en memoria, por proceso. Alcanza para el volumen esperado (~10
 * Empresas Revendedoras, ~1.500 Cuentas) con un único contenedor de backend. Si
 * en algún momento se corren varias instancias, hay que mover el contador a
 * Redis (ya está en el stack por BullMQ).
 */
@Injectable()
export class ProveedorRateLimiterService {
  private readonly logger = new Logger(ProveedorRateLimiterService.name);
  private readonly capacidad: number;
  private readonly reposicionPorMs: number;

  private fichas: number;
  private ultimaReposicion = Date.now();
  /** Cola de espera: garantiza orden FIFO entre llamadas encoladas. */
  private cadena: Promise<void> = Promise.resolve();

  constructor(config: ConfigService) {
    this.capacidad = Math.max(1, config.get<number>('sensa.rateLimitPerMinute') ?? 60);
    this.reposicionPorMs = this.capacidad / 60_000;
    this.fichas = this.capacidad;
  }

  /**
   * Espera lo necesario para no exceder el límite y ejecuta la operación.
   */
  async ejecutar<T>(operacion: () => Promise<T>): Promise<T> {
    await this.tomarFicha();
    return operacion();
  }

  private tomarFicha(): Promise<void> {
    const anterior = this.cadena;
    let liberar!: () => void;
    this.cadena = new Promise<void>((resolve) => {
      liberar = resolve;
    });

    return anterior
      .then(() => this.esperarFicha())
      .finally(() => {
        liberar();
      });
  }

  private async esperarFicha(): Promise<void> {
    this.reponer();
    if (this.fichas >= 1) {
      this.fichas -= 1;
      return;
    }
    const esperaMs = Math.ceil((1 - this.fichas) / this.reposicionPorMs);
    this.logger.debug(
      `Límite de llamadas al Proveedor alcanzado, esperando ${esperaMs} ms antes de continuar.`,
    );
    await new Promise((resolve) => setTimeout(resolve, esperaMs));
    this.reponer();
    this.fichas = Math.max(0, this.fichas - 1);
  }

  private reponer(): void {
    const ahora = Date.now();
    const transcurrido = ahora - this.ultimaReposicion;
    if (transcurrido <= 0) return;
    this.fichas = Math.min(this.capacidad, this.fichas + transcurrido * this.reposicionPorMs);
    this.ultimaReposicion = ahora;
  }
}
