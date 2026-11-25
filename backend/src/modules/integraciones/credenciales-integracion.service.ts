import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccionAuditoria, EntidadAuditada } from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  SCOPES_INTEGRACION,
  SCOPES_POR_DEFECTO,
  type ScopeIntegracion,
} from './scopes';

/** Resultado de autenticar una key, antes de fijar el contexto del request. */
export interface CredencialAutenticada {
  empresaRevendedoraId: string;
  teamMemberId?: string;
  /** null cuando la key vino del fallback de variables de entorno. */
  credencialId: string | null;
  origen: 'base' | 'env';
}

/** Forma pública de una credencial: nunca incluye la key ni su hash. */
export interface CredencialSerializada {
  id: string;
  empresa_revendedora_id: string;
  empresa: { id: string; razon_social: string };
  nombre: string;
  prefijo: string;
  scopes: ScopeIntegracion[];
  activa: boolean;
  team_member: { id: string; email: string; nombre: string | null } | null;
  ultimo_uso_en: Date | null;
  revocado_en: Date | null;
  creado_en: Date;
}

interface CredencialConRelaciones {
  id: string;
  empresaRevendedoraId: string;
  nombre: string;
  keyPrefix: string;
  scopes: string[];
  activa: boolean;
  ultimoUsoEn: Date | null;
  revocadoEn: Date | null;
  creadoEn: Date;
  empresaRevendedora: { id: string; razonSocial: string };
  teamMember: { id: string; email: string; nombre: string | null } | null;
}

const INCLUDE_RELACIONES = {
  empresaRevendedora: { select: { id: true, razonSocial: true } },
  teamMember: { select: { id: true, email: true, nombre: true } },
} as const;

/**
 * Credenciales de integración por Empresa Revendedora.
 *
 * Reemplaza la dupla `API_KEY + EMPRESA_ID` del `.env`: la key identifica a la
 * Empresa y sirve para cualquier API de integración (bot, portal o futuras).
 * Solo se guarda el hash SHA-256; el texto plano se devuelve una única vez.
 */
@Injectable()
export class CredencialesIntegracionService {
  private readonly logger = new Logger(CredencialesIntegracionService.name);
  private readonly fallbackAvisado = new Set<ScopeIntegracion>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly contexto: RequestContextService,
  ) {}

  /**
   * Resuelve una key y valida que pueda usar el alcance pedido.
   *
   * Primero busca en base. Si la key no existe y el fallback está habilitado,
   * compara contra las variables de entorno históricas. Una key revocada en
   * base NUNCA cae al fallback: así la revocación es efectiva.
   */
  async autenticar(key: string, scope: ScopeIntegracion): Promise<CredencialAutenticada> {
    const credencial = await this.prisma.sinContexto.integracionCredencial.findUnique({
      where: { keyHash: this.hash(key) },
      select: {
        id: true,
        empresaRevendedoraId: true,
        teamMemberId: true,
        scopes: true,
        activa: true,
        revocadoEn: true,
      },
    });

    if (credencial) {
      if (!credencial.activa || credencial.revocadoEn) {
        throw new UnauthorizedException('Credencial de integración inválida.');
      }
      if (!credencial.scopes.includes(scope)) {
        throw new ForbiddenException('La credencial no está habilitada para esta API.');
      }
      return {
        empresaRevendedoraId: credencial.empresaRevendedoraId,
        teamMemberId: credencial.teamMemberId ?? undefined,
        credencialId: credencial.id,
        origen: 'base',
      };
    }

    const fallbackHabilitado = this.config.get<boolean>('integraciones.fallbackEnv') ?? true;
    if (!fallbackHabilitado) {
      throw new UnauthorizedException('Credencial de integración inválida.');
    }

    const entorno = this.configuracionDeEntorno(scope);
    if (
      !entorno.apiKey ||
      !entorno.empresaRevendedoraId ||
      !this.claveValida(entorno.apiKey, key)
    ) {
      throw new UnauthorizedException('Credencial de integración inválida.');
    }

    if (!this.fallbackAvisado.has(scope)) {
      this.fallbackAvisado.add(scope);
      this.logger.warn(
        `Integración autenticada con variables de entorno (${scope}). ` +
          'Crear una credencial en Configuración para dejar de usar el fallback.',
      );
    }

    return {
      empresaRevendedoraId: entorno.empresaRevendedoraId,
      teamMemberId: entorno.teamMemberId,
      credencialId: null,
      origen: 'env',
    };
  }

  /** Crea una credencial y devuelve la key en texto plano por única vez. */
  async crear(params: {
    empresaRevendedoraId: string;
    nombre: string;
    scopes?: ScopeIntegracion[];
    teamMemberId?: string;
  }): Promise<{ credencial: CredencialSerializada; api_key: string }> {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!operadorPrincipalId) {
      throw new ForbiddenException(
        'Sólo el Operador Principal puede administrar credenciales de integración.',
      );
    }

    const empresa = await this.prisma.db.empresaRevendedora.findUnique({
      where: { id: params.empresaRevendedoraId },
      select: { id: true, operadorPrincipalId: true },
    });
    if (!empresa || empresa.operadorPrincipalId !== operadorPrincipalId) {
      throw new NotFoundException('La Empresa Revendedora no existe o no está disponible.');
    }

    const nombre = params.nombre.trim();
    if (nombre.length < 2) {
      throw new BadRequestException('El nombre de la credencial debe tener al menos 2 caracteres.');
    }

    if (params.teamMemberId) {
      await this.validarTeamMember(params.teamMemberId, empresa.id);
    }

    const scopes = this.normalizarScopes(params.scopes);
    const apiKey = `iptv_${randomBytes(32).toString('hex')}`;

    const creada = await this.prisma.db.integracionCredencial.create({
      data: {
        operadorPrincipalId,
        empresaRevendedoraId: empresa.id,
        nombre,
        keyHash: this.hash(apiKey),
        keyPrefix: apiKey.slice(0, 12),
        scopes,
        teamMemberId: params.teamMemberId ?? null,
      },
      include: INCLUDE_RELACIONES,
    });

    await this.audit.registrar({
      accion: AccionAuditoria.alta_integracion_credencial,
      entidad: EntidadAuditada.IntegracionCredencial,
      entidadId: creada.id,
      empresaRevendedoraId: empresa.id,
      operadorPrincipalId,
      detalle: {
        empresa_revendedora_id: empresa.id,
        nombre: creada.nombre,
        prefijo: creada.keyPrefix,
        scopes,
      },
    });

    return { credencial: this.serializar(creada as CredencialConRelaciones), api_key: apiKey };
  }

  async listar(params: {
    empresaRevendedoraId?: string;
    incluirRevocadas?: boolean;
  }): Promise<CredencialSerializada[]> {
    const filas = await this.prisma.db.integracionCredencial.findMany({
      where: {
        ...(params.empresaRevendedoraId
          ? { empresaRevendedoraId: params.empresaRevendedoraId }
          : {}),
        ...(params.incluirRevocadas ? {} : { activa: true }),
      },
      include: INCLUDE_RELACIONES,
      orderBy: { creadoEn: 'desc' },
    });
    return filas.map((fila) => this.serializar(fila as CredencialConRelaciones));
  }

  /** Revoca una credencial. Es idempotente. */
  async revocar(id: string): Promise<CredencialSerializada> {
    const actual = await this.prisma.db.integracionCredencial.findUnique({
      where: { id },
      include: INCLUDE_RELACIONES,
    });
    if (!actual) throw new NotFoundException('La credencial no existe o no está disponible.');

    if (!actual.activa) {
      return this.serializar(actual as CredencialConRelaciones);
    }

    const revocada = await this.prisma.db.integracionCredencial.update({
      where: { id },
      data: { activa: false, revocadoEn: new Date() },
      include: INCLUDE_RELACIONES,
    });

    await this.audit.registrar({
      accion: AccionAuditoria.revocacion_integracion_credencial,
      entidad: EntidadAuditada.IntegracionCredencial,
      entidadId: id,
      empresaRevendedoraId: revocada.empresaRevendedoraId,
      detalle: {
        empresa_revendedora_id: revocada.empresaRevendedoraId,
        nombre: revocada.nombre,
        prefijo: revocada.keyPrefix,
      },
    });

    return this.serializar(revocada as CredencialConRelaciones);
  }

  /**
   * Crea una credencial nueva con los mismos datos y revoca la anterior.
   * La key nueva se devuelve una sola vez.
   */
  async rotar(id: string): Promise<{ credencial: CredencialSerializada; api_key: string }> {
    const actual = await this.prisma.db.integracionCredencial.findUnique({
      where: { id },
      select: {
        id: true,
        empresaRevendedoraId: true,
        nombre: true,
        scopes: true,
        teamMemberId: true,
        activa: true,
      },
    });
    if (!actual) throw new NotFoundException('La credencial no existe o no está disponible.');
    if (!actual.activa) {
      throw new BadRequestException('La credencial está revocada: cree una nueva.');
    }

    const nueva = await this.crear({
      empresaRevendedoraId: actual.empresaRevendedoraId,
      nombre: actual.nombre,
      scopes: actual.scopes as ScopeIntegracion[],
      teamMemberId: actual.teamMemberId ?? undefined,
    });

    // Si fallara la revocación, se devuelve igual la key nueva: es preferible
    // que el integrador pueda actualizarla y revocar la vieja a mano.
    try {
      await this.revocar(id);
    } catch (error) {
      this.logger.error(
        `Se creó la credencial rotada pero no se pudo revocar la anterior ${id}: ` +
          (error as Error).message,
      );
    }
    return nueva;
  }

  /** Actualiza el último uso sin afectar la respuesta si falla. */
  async marcarUso(id: string): Promise<void> {
    try {
      await this.prisma.db.integracionCredencial.update({
        where: { id },
        data: { ultimoUsoEn: new Date() },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo actualizar el último uso de la credencial ${id}: ${(error as Error).message}`,
      );
    }
  }

  private async validarTeamMember(teamMemberId: string, empresaRevendedoraId: string) {
    const teamMember = await this.prisma.db.teamMember.findUnique({
      where: { id: teamMemberId },
      select: { empresaRevendedoraId: true },
    });
    if (!teamMember || teamMember.empresaRevendedoraId !== empresaRevendedoraId) {
      throw new BadRequestException(
        'El Team Member indicado no pertenece a la Empresa Revendedora de la credencial.',
      );
    }
  }

  private normalizarScopes(scopes?: ScopeIntegracion[]): ScopeIntegracion[] {
    if (!scopes || scopes.length === 0) return [...SCOPES_POR_DEFECTO];

    const unicos = [...new Set(scopes)];
    const invalidos = unicos.filter(
      (scope) => !(SCOPES_INTEGRACION as readonly string[]).includes(scope),
    );
    if (invalidos.length > 0) {
      throw new BadRequestException(`Alcance de integración inválido: ${invalidos.join(', ')}.`);
    }
    return unicos;
  }

  private serializar(credencial: CredencialConRelaciones): CredencialSerializada {
    return {
      id: credencial.id,
      empresa_revendedora_id: credencial.empresaRevendedoraId,
      empresa: {
        id: credencial.empresaRevendedora.id,
        razon_social: credencial.empresaRevendedora.razonSocial,
      },
      nombre: credencial.nombre,
      prefijo: credencial.keyPrefix,
      scopes: credencial.scopes as ScopeIntegracion[],
      activa: credencial.activa,
      team_member: credencial.teamMember
        ? {
            id: credencial.teamMember.id,
            email: credencial.teamMember.email,
            nombre: credencial.teamMember.nombre,
          }
        : null,
      ultimo_uso_en: credencial.ultimoUsoEn,
      revocado_en: credencial.revocadoEn,
      creado_en: credencial.creadoEn,
    };
  }

  private configuracionDeEntorno(scope: ScopeIntegracion): {
    apiKey?: string;
    empresaRevendedoraId?: string;
    teamMemberId?: string;
  } {
    if (scope === 'whatsapp_bot') {
      return {
        apiKey: this.config.get<string>('whatsappBot.apiKey'),
        empresaRevendedoraId: this.config.get<string>('whatsappBot.empresaRevendedoraId'),
        teamMemberId: this.config.get<string>('whatsappBot.teamMemberId'),
      };
    }
    return {
      apiKey: this.config.get<string>('portalCliente.apiKey'),
      empresaRevendedoraId: this.config.get<string>('portalCliente.empresaRevendedoraId'),
      teamMemberId: this.config.get<string>('portalCliente.teamMemberId'),
    };
  }

  private hash(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /** Comparación en tiempo constante para no filtrar la key del `.env`. */
  private claveValida(esperada: string, recibida: string): boolean {
    const a = Buffer.from(esperada);
    const b = Buffer.from(recibida);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
