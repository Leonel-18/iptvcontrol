import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccionAuditoria, EntidadAuditada, MotivoFinVentanaCuriosidad } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { PrismaService, TransactionClient } from '../../common/prisma/prisma.service';

export class CuentaEnVentanaCuriosidadError extends ConflictException {
  constructor(cuentaId: string, finPrevistoEn: Date) {
    super({
      statusCode: 409,
      error: 'CuentaEnVentanaCuriosidad',
      message: 'La Cuenta todavía no está habilitada para recibir un Cliente Final nuevo.',
      cuenta_id: cuentaId,
      fin_previsto_en: finPrevistoEn.toISOString(),
    });
  }
}

interface AbrirVentanaParams {
  cuentaId: string;
  clienteFinalId: string;
  empresaRevendedoraId: string;
  ventaCompartidaId: string;
  duracionSolicitadaMinutos?: number;
  teamMemberId?: string;
}

@Injectable()
export class VentanasCuriosidadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
    private readonly audit: AuditService,
  ) {}

  async abrirPorNuevaVentaEnTx(tx: TransactionClient, params: AbrirVentanaParams): Promise<void> {
    const ahora = new Date();
    await this.cerrarVencidasEnTx(tx, params.cuentaId, ahora);

    const activa = await tx.ventanaCuriosidad.findFirst({
      where: { cuentaId: params.cuentaId, finRealEn: null, finPrevistoEn: { gt: ahora } },
      select: { finPrevistoEn: true },
    });
    if (activa) throw new CuentaEnVentanaCuriosidadError(params.cuentaId, activa.finPrevistoEn);

    const empresa = await tx.empresaRevendedora.findUniqueOrThrow({
      where: { id: params.empresaRevendedoraId },
      select: { duracionVentanaCuriosidadMinutos: true },
    });
    const predeterminada = empresa.duracionVentanaCuriosidadMinutos;
    // La duración predeterminada de la Empresa sólo precarga los formularios: el
    // vendedor elige en cada venta la duración que quiera, por arriba o por abajo.
    // Cuando la venta no manda una duración propia (ej. resolución de incidencias),
    // se aplica la predeterminada.
    const aplicada = params.duracionSolicitadaMinutos ?? predeterminada;
    if (!Number.isInteger(aplicada) || aplicada < 0) {
      throw new BadRequestException(
        'La Ventana de Alta debe ser un número entero de minutos mayor o igual a 0.',
      );
    }

    const finPrevistoEn = new Date(ahora.getTime() + aplicada * 60_000);
    const ventana = await tx.ventanaCuriosidad.create({
      data: {
        cuentaId: params.cuentaId,
        clienteFinalId: params.clienteFinalId,
        empresaRevendedoraId: params.empresaRevendedoraId,
        ventaCompartidaId: params.ventaCompartidaId,
        inicioEn: ahora,
        duracionPredeterminadaMinutos: predeterminada,
        duracionAplicadaMinutos: aplicada,
        finPrevistoEn,
        finRealEn: aplicada === 0 ? ahora : null,
        motivoFin: aplicada === 0 ? MotivoFinVentanaCuriosidad.vencimiento : null,
        iniciadaPorTeamMemberId: params.teamMemberId ?? null,
      },
    });

    await this.audit.registrarEnTx(tx, {
      accion: AccionAuditoria.apertura_ventana_curiosidad,
      entidad: EntidadAuditada.VentanaCuriosidad,
      entidadId: ventana.id,
      empresaRevendedoraId: params.empresaRevendedoraId,
      detalle: {
        cuenta_id: params.cuentaId,
        cliente_final_id: params.clienteFinalId,
        inicio_en: ahora.toISOString(),
        fin_previsto_en: finPrevistoEn.toISOString(),
        duracion_predeterminada_minutos: predeterminada,
        duracion_aplicada_minutos: aplicada,
      },
    });
  }

  /**
   * Reasignar un Dispositivo `disponible` a un Cliente Final es OTRA vía de
   * alta (regla de negocio 6, riesgo aceptado de credenciales compartidas):
   * si ese cliente todavía no tiene una venta en esta Cuenta, es tan "nuevo"
   * como uno que pasa por el wizard, y debe respetar el mismo bloqueo.
   */
  async asegurarClientePermitido(cuentaId: string, clienteFinalId: string): Promise<void> {
    const ahora = new Date();
    await this.prisma.transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cuentaId}))`;
      await this.cerrarVencidasEnTx(tx, cuentaId, ahora);
      const activa = await tx.ventanaCuriosidad.findFirst({
        where: { cuentaId, finRealEn: null, finPrevistoEn: { gt: ahora } },
      });
      if (activa && activa.clienteFinalId !== clienteFinalId) {
        throw new CuentaEnVentanaCuriosidadError(cuentaId, activa.finPrevistoEn);
      }
    });
  }

  async cerrarPorCancelacionEnTx(
    tx: TransactionClient,
    cuentaId: string,
    clienteFinalId: string,
    ahora = new Date(),
  ): Promise<void> {
    await this.cerrarVencidasEnTx(tx, cuentaId, ahora);
    await tx.ventanaCuriosidad.updateMany({
      where: { cuentaId, clienteFinalId, finRealEn: null, finPrevistoEn: { gt: ahora } },
      data: { finRealEn: ahora, motivoFin: MotivoFinVentanaCuriosidad.cancelacion_venta },
    });
  }

  async levantarManualmente(cuentaId: string) {
    if (this.contexto.esOperador || !this.contexto.empresaRevendedoraId) {
      throw new ForbiddenException(
        'Sólo la Empresa Revendedora dueña puede levantar la Ventana de Alta.',
      );
    }
    const teamMemberId = this.contexto.teamMemberId;
    const ahora = new Date();
    const ventana = await this.prisma.transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cuentaId}))`;
      const cuenta = await tx.cuenta.findUnique({ where: { id: cuentaId } });
      if (!cuenta) throw new NotFoundException('La Cuenta no existe o no está disponible.');
      if (cuenta.esExclusiva) {
        throw new BadRequestException(
          'La Ventana de Alta sólo aplica a Cuentas compartidas.',
        );
      }
      await this.cerrarVencidasEnTx(tx, cuentaId, ahora);
      const activa = await tx.ventanaCuriosidad.findFirst({
        where: { cuentaId, finRealEn: null, finPrevistoEn: { gt: ahora } },
      });
      if (!activa) throw new BadRequestException('La Cuenta no tiene una Ventana activa.');

      const actualizada = await tx.ventanaCuriosidad.update({
        where: { id: activa.id },
        data: {
          finRealEn: ahora,
          motivoFin: MotivoFinVentanaCuriosidad.levantamiento_manual,
          finalizadaPorTeamMemberId: teamMemberId ?? null,
        },
      });
      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.levantamiento_ventana_curiosidad,
        entidad: EntidadAuditada.VentanaCuriosidad,
        entidadId: activa.id,
        detalle: {
          cuenta_id: cuentaId,
          fin_previsto_en: activa.finPrevistoEn.toISOString(),
          fin_real_en: ahora.toISOString(),
        },
      });
      return actualizada;
    });
    return this.mapear(ventana);
  }

  async obtenerEstadoEHistorial(cuentaId: string) {
    const ahora = new Date();
    await this.prisma.transaction(async (tx) => {
      await this.cerrarVencidasEnTx(tx, cuentaId, ahora);
    });
    const ventanas = await this.prisma.db.ventanaCuriosidad.findMany({
      where: { cuentaId },
      include: {
        iniciadaPorTeamMember: { select: { id: true, nombre: true, email: true } },
        finalizadaPorTeamMember: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { inicioEn: 'desc' },
    });
    const activa = ventanas.find((ventana) => ventana.finRealEn === null) ?? null;
    return {
      activa: activa ? this.mapear(activa) : null,
      historial: ventanas.map((ventana) => this.mapear(ventana)),
    };
  }

  async cerrarVencidasEnTx(
    tx: TransactionClient,
    cuentaId: string,
    ahora = new Date(),
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE "ventana_curiosidad"
      SET "fin_real_en" = "fin_previsto_en",
          "motivo_fin" = 'vencimiento'::"MotivoFinVentanaCuriosidad",
          "actualizado_en" = ${ahora}
      WHERE "cuenta_id" = ${cuentaId}::uuid
        AND "fin_real_en" IS NULL
        AND "fin_previsto_en" <= ${ahora}
    `;
  }

  private mapear(ventana: {
    id: string;
    inicioEn: Date;
    finPrevistoEn: Date;
    finRealEn: Date | null;
    duracionPredeterminadaMinutos: number;
    duracionAplicadaMinutos: number;
    motivoFin: MotivoFinVentanaCuriosidad | null;
    iniciadaPorTeamMember?: { id: string; nombre: string | null; email: string } | null;
    finalizadaPorTeamMember?: { id: string; nombre: string | null; email: string } | null;
  }) {
    const actor = (team?: { id: string; nombre: string | null; email: string } | null) =>
      team ? { id: team.id, nombre: team.nombre ?? team.email } : null;
    return {
      id: ventana.id,
      activa: ventana.finRealEn === null,
      inicio_en: ventana.inicioEn,
      fin_previsto_en: ventana.finPrevistoEn,
      fin_real_en: ventana.finRealEn,
      duracion_predeterminada_minutos: ventana.duracionPredeterminadaMinutos,
      duracion_aplicada_minutos: ventana.duracionAplicadaMinutos,
      motivo_fin: ventana.motivoFin,
      iniciada_por: actor(ventana.iniciadaPorTeamMember),
      finalizada_por: actor(ventana.finalizadaPorTeamMember),
    };
  }
}
