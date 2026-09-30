import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccionNotificacion, TipoNotificacion } from '@prisma/client';
import { PrismaService, TransactionClient } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';

export interface CrearNotificacionParams {
  empresaRevendedoraId: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  accionTipo?: AccionNotificacion | null;
  accionRefId?: string | null;
  /** Clave de deduplicación por tenant (evita repetir el mismo aviso). */
  clave?: string | null;
}

/**
 * Centro de notificaciones persistentes (Épica C, HU-N01).
 *
 * Una notificación es del TENANT: todos los Team Members de la Empresa
 * Revendedora la ven. El estado leído/no leído es individual y vive en
 * `notificacion_lectura` (con quién y cuándo). Los generadores de avisos
 * (HU-N03/N04 y Épica D) usan `crear`, que es idempotente por `clave`.
 */
@Injectable()
export class NotificacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
  ) {}

  /**
   * Crea una notificación para una Empresa Revendedora. Si se pasa `clave` y ya
   * existe una igual para ese tenant, no la duplica: devuelve `{ creada: false }`.
   * Así un job puede correr seguido sin repetir el mismo aviso.
   */
  async crear(params: CrearNotificacionParams): Promise<{ id: string; creada: boolean }> {
    return this.prisma.transaction((tx) => this.crearEnTx(tx, params));
  }

  /**
   * Igual que `crear`, pero dentro de una transacción ya abierta: lo usan los
   * jobs de avisos, que corren con contexto de Operador Principal.
   */
  async crearEnTx(
    tx: TransactionClient,
    params: CrearNotificacionParams,
  ): Promise<{ id: string; creada: boolean }> {
    if (params.clave) {
      const existente = await tx.notificacion.findUnique({
        where: {
          empresaRevendedoraId_clave: {
            empresaRevendedoraId: params.empresaRevendedoraId,
            clave: params.clave,
          },
        },
        select: { id: true },
      });
      if (existente) return { id: existente.id, creada: false };
    }

    const creada = await tx.notificacion.create({
      data: {
        empresaRevendedoraId: params.empresaRevendedoraId,
        tipo: params.tipo,
        titulo: params.titulo,
        mensaje: params.mensaje,
        accionTipo: params.accionTipo ?? null,
        accionRefId: params.accionRefId ?? null,
        clave: params.clave ?? null,
      },
      select: { id: true },
    });
    return { id: creada.id, creada: true };
  }

  /** Últimas notificaciones del tenant, con el estado leído del usuario actual. */
  async listar() {
    const { empresaRevendedoraId, teamMemberId } = this.exigirRevendedor();

    const notificaciones = await this.prisma.db.notificacion.findMany({
      where: { empresaRevendedoraId },
      include: { lecturas: { where: { teamMemberId }, select: { leidoEn: true } } },
      orderBy: { creadoEn: 'desc' },
      take: 50,
    });

    return {
      no_leidas: notificaciones.filter((notificacion) => notificacion.lecturas.length === 0).length,
      data: notificaciones.map((notificacion) => ({
        id: notificacion.id,
        tipo: notificacion.tipo,
        titulo: notificacion.titulo,
        mensaje: notificacion.mensaje,
        accion_tipo: notificacion.accionTipo,
        accion_ref_id: notificacion.accionRefId,
        leida: notificacion.lecturas.length > 0,
        leida_en: notificacion.lecturas[0]?.leidoEn ?? null,
        creado_en: notificacion.creadoEn,
      })),
    };
  }

  /** Cantidad de notificaciones sin leer del usuario actual (para la campana). */
  async contarNoLeidas() {
    const { empresaRevendedoraId, teamMemberId } = this.exigirRevendedor();
    const noLeidas = await this.prisma.db.notificacion.count({
      where: { empresaRevendedoraId, lecturas: { none: { teamMemberId } } },
    });
    return { no_leidas: noLeidas };
  }

  /** Marca una notificación como leída para el usuario actual (idempotente). */
  async marcarLeida(id: string) {
    const { empresaRevendedoraId, teamMemberId } = this.exigirRevendedor();

    const notificacion = await this.prisma.db.notificacion.findFirst({
      where: { id, empresaRevendedoraId },
      select: { id: true },
    });
    if (!notificacion) throw new NotFoundException('La notificación no existe.');

    await this.prisma.db.notificacionLectura.upsert({
      where: { notificacionId_teamMemberId: { notificacionId: id, teamMemberId } },
      create: { notificacionId: id, teamMemberId, empresaRevendedoraId },
      update: {},
    });
    return { id, leida: true };
  }

  /** Marca como leídas todas las notificaciones pendientes del usuario actual. */
  async marcarTodasLeidas() {
    const { empresaRevendedoraId, teamMemberId } = this.exigirRevendedor();

    const pendientes = await this.prisma.db.notificacion.findMany({
      where: { empresaRevendedoraId, lecturas: { none: { teamMemberId } } },
      select: { id: true },
    });

    if (pendientes.length > 0) {
      await this.prisma.db.notificacionLectura.createMany({
        data: pendientes.map((notificacion) => ({
          notificacionId: notificacion.id,
          teamMemberId,
          empresaRevendedoraId,
        })),
        skipDuplicates: true,
      });
    }

    return { marcadas: pendientes.length };
  }

  private exigirRevendedor(): { empresaRevendedoraId: string; teamMemberId: string } {
    const empresaRevendedoraId = this.contexto.empresaRevendedoraId;
    const teamMemberId = this.contexto.teamMemberId;
    if (this.contexto.esOperador || !empresaRevendedoraId || !teamMemberId) {
      throw new ForbiddenException('Las notificaciones son del panel de cada Empresa Revendedora.');
    }
    return { empresaRevendedoraId, teamMemberId };
  }
}
