import { Injectable, Logger } from '@nestjs/common';
import { AccionAuditoria, EntidadAuditada, Prisma } from '@prisma/client';
import { PrismaService, TransactionClient } from '../prisma/prisma.service';
import { RequestContextService } from '../context/request-context.service';

export interface RegistroAuditoria {
  accion: AccionAuditoria;
  entidad: EntidadAuditada;
  entidadId?: string | null;
  /** Datos del cambio (valores anterior/nuevo). Nunca credenciales. */
  detalle?: Prisma.InputJsonValue;
  /** Se fuerza el tenant cuando la acción la ejecuta el Operador Principal
   *  sobre una Empresa Revendedora concreta (ej. cambio de modalidad). */
  empresaRevendedoraId?: string | null;
  operadorPrincipalId?: string | null;
}

/**
 * Registro de auditoría (docs/03_Reglas_de_Negocio.md, sección 11).
 *
 * Regla de oro: el `detalle` NO debe contener credenciales de Cuenta ni datos
 * de contacto de Clientes Finales. El Operador Principal puede leer el log
 * completo, y su visibilidad está limitada a IDs por la sección 4.2 — si acá
 * guardáramos un nombre, esa restricción se filtraría por la ventana de atrás.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
  ) {}

  /** Registra dentro de una transacción existente (lo habitual en los flujos). */
  async registrarEnTx(tx: TransactionClient, registro: RegistroAuditoria): Promise<void> {
    await tx.auditLog.create({ data: this.armarData(registro) });
  }

  /** Registra de forma suelta. Un fallo acá nunca debe tumbar la operación. */
  async registrar(registro: RegistroAuditoria): Promise<void> {
    try {
      await this.prisma.db.auditLog.create({ data: this.armarData(registro) });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la acción ${registro.accion} en el Audit Log: ` +
          (error as Error).message,
      );
    }
  }

  private armarData(registro: RegistroAuditoria): Prisma.AuditLogUncheckedCreateInput {
    const ctx = this.contexto.get();
    return {
      teamMemberId: ctx?.teamMemberId ?? null,
      empresaRevendedoraId:
        registro.empresaRevendedoraId !== undefined
          ? registro.empresaRevendedoraId
          : (ctx?.empresaRevendedoraId ?? null),
      operadorPrincipalId:
        registro.operadorPrincipalId !== undefined
          ? registro.operadorPrincipalId
          : (ctx?.operadorPrincipalId ?? null),
      accion: registro.accion,
      entidadAfectada: registro.entidad,
      entidadId: registro.entidadId ?? null,
      detalle: registro.detalle ?? undefined,
    };
  }
}
