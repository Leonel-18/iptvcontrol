import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';

/**
 * Autenticación del Portal de Cliente externo.
 *
 * Igual que el bot de WhatsApp: no es un usuario humano del panel, así que se
 * autentica con una API key fija en variable de entorno y opera sobre una
 * Empresa Revendedora FIJA (no la elige el llamador). El "actor" de las acciones
 * es un Team Member de sistema configurable, para que el Audit Log muestre
 * "Cliente desde el portal".
 */
@Injectable()
export class PortalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(PortalApiKeyGuard.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esperada = this.config.get<string>('portalCliente.apiKey');
    const empresaRevendedoraId = this.config.get<string>('portalCliente.empresaRevendedoraId');

    // Sin configuración, el endpoint no existe para el cliente.
    if (!esperada || !empresaRevendedoraId) {
      throw new ServiceUnavailableException(
        'La integración del Portal de Cliente no está configurada en el servidor.',
      );
    }

    const request = context.switchToHttp().getRequest();
    const recibida = request.headers['x-api-key'];
    if (typeof recibida !== 'string' || !this.claveValida(esperada, recibida)) {
      throw new UnauthorizedException('Credencial de integración inválida.');
    }

    // Se fija el tenant antes de resolver el operador (RLS).
    const teamMemberId = this.config.get<string>('portalCliente.teamMemberId');
    this.contexto.set({
      esOperador: false,
      empresaRevendedoraId,
      teamMemberId: teamMemberId ?? undefined,
    });

    const empresa = await this.prisma.db.empresaRevendedora.findUnique({
      where: { id: empresaRevendedoraId },
      select: { operadorPrincipalId: true, estado: true },
    });

    if (!empresa) {
      throw new ForbiddenException(
        'La Empresa Revendedora configurada para el portal no existe en IPTVControl.',
      );
    }
    if (empresa.estado === 'suspendida') {
      throw new ForbiddenException(
        'La Empresa Revendedora configurada para el portal está suspendida.',
      );
    }

    this.contexto.set({ operadorPrincipalId: empresa.operadorPrincipalId });
    return true;
  }

  /** Comparación en tiempo constante para no filtrar la API key. */
  private claveValida(esperada: string, recibida: string): boolean {
    const a = Buffer.from(esperada);
    const b = Buffer.from(recibida);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
