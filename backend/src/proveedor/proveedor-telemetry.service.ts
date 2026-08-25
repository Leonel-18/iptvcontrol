import { Injectable, Logger } from '@nestjs/common';
import { EstadoLlamadaProveedor } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RequestContextService } from '../common/context/request-context.service';

export interface RegistroLlamada {
  operacion: string;
  metodo: string;
  ruta: string;
  estado: EstadoLlamadaProveedor;
  codigo?: number;
  duracionMs: number;
  mensaje?: string;
  /** Se informa explícitamente cuando la llamada la origina un job de BullMQ. */
  operadorPrincipalId?: string | null;
}

/**
 * Traza de las llamadas a la API del Proveedor, que alimenta el panel de salud
 * de la integración del dashboard del Operador Principal (docs/04, sección 5).
 *
 * Sirve para detectar un problema de integración ANTES de que una Empresa
 * Revendedora llame para reportar el síntoma. Escribe en tabla propia porque el
 * dato tiene que sobrevivir a un reinicio del contenedor.
 *
 * Nunca se guarda el token ni las credenciales de la Cuenta: sólo operación,
 * ruta, código y mensaje técnico.
 */
@Injectable()
export class ProveedorTelemetryService {
  private readonly logger = new Logger('ProveedorTelemetry');

  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
  ) {}

  async registrar(registro: RegistroLlamada): Promise<void> {
    const operadorPrincipalId =
      registro.operadorPrincipalId ?? this.contexto.operadorPrincipalId ?? null;

    if (registro.estado === EstadoLlamadaProveedor.fallida) {
      this.logger.warn(
        `${registro.operacion} ${registro.metodo} ${registro.ruta} → ` +
          `${registro.codigo ?? 'sin código'} (${registro.duracionMs} ms): ${registro.mensaje ?? ''}`,
      );
    }

    // La tabla `llamada_proveedor` es multicuenta: se identifica por
    // `operador_principal_id`. La política RLS exige el contexto de operador
    // (la transección se abre con `app.is_operator=on` y `app.current_operador`).
    // Prisma siempre emite `INSERT ... RETURNING`, y el `RETURNING` re-cae sobre
    // el `USING` de la política: sin ese contexto, la escritura (que sí pasaría
    // el `WITH CHECK`) se rechaza al devolverse la fila.
    if (operadorPrincipalId) {
      try {
        await this.prisma.transactionComoOperador(operadorPrincipalId, (tx) =>
          tx.llamadaProveedor.create({
            data: {
              operadorPrincipalId,
              operacion: registro.operacion,
              metodo: registro.metodo,
              ruta: registro.ruta.slice(0, 200),
              estado: registro.estado,
              codigo: registro.codigo,
              duracionMs: registro.duracionMs,
              mensaje: registro.mensaje?.slice(0, 500),
            },
          }),
        );
      } catch (error) {
        // La traza es un apoyo operativo: si falla, no debe romper la operación.
        this.logger.error(
          `No se pudo registrar la llamada al Proveedor: ${(error as Error).message}`,
        );
      }
    }
  }
}
