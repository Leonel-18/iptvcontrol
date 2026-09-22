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
 * Autenticación del bot de WhatsApp.
 *
 * A diferencia del resto de la API (que exige un token de Auth0 + un Team
 * Member), este endpoint se autentica con una API key fija en variable de
 * entorno. El bot no es una persona: no tiene login ni panel.
 *
 * El "usuario hardcodeado" del bot se implementa como TENANT fijo: la Empresa
 * Revendedora se toma de `WSP_BOT_EMPRESA_REVENDEDORA_ID` y se inyecta en el
 * contexto del request. De ahí en adelante RLS y todos los servicios quedan
 * acotados a esa empresa, sin que el bot pueda elegir a quién le crea Cuentas.
 *
 * La API key NO se versiona en el repo (ver .env.example): si estuviera en el
 * código, cualquiera con acceso al repositorio podría crear Cuentas pagas en el
 * Proveedor a nombre de la empresa.
 */
@Injectable()
export class BotApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(BotApiKeyGuard.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esperada = this.config.get<string>('whatsappBot.apiKey');
    const empresaRevendedoraId = this.config.get<string>('whatsappBot.empresaRevendedoraId');

    // Sin configuración el endpoint directamente no existe para el cliente: no
    // es un error de credenciales, es una integración que no se habilitó.
    if (!esperada || !empresaRevendedoraId) {
      throw new ServiceUnavailableException(
        'La integración de WhatsApp no está configurada en el servidor.',
      );
    }

    const request = context.switchToHttp().getRequest();
    const recibida = request.headers['x-api-key'];
    if (typeof recibida !== 'string' || !this.claveValida(esperada, recibida)) {
      throw new UnauthorizedException('Credencial de integración inválida.');
    }

    // Se fija el tenant ANTES de resolver el operador: la política RLS de
    // `empresa_revendedora` habilita la lectura cuando `id = app.current_tenant`.
    const teamMemberId = this.config.get<string>('whatsappBot.teamMemberId');
    this.contexto.set({
      esOperador: false,
      empresaRevendedoraId,
      teamMemberId: teamMemberId ?? undefined,
    });

    const empresa = await this.prisma.db.empresaRevendedora.findUnique({
      where: { id: empresaRevendedoraId },
      select: { operadorPrincipalId: true, estado: true, razonSocial: true },
    });

    if (!empresa) {
      throw new ForbiddenException(
        'La Empresa Revendedora configurada para el bot no existe en IPTVControl.',
      );
    }
    if (empresa.estado === 'suspendida') {
      throw new ForbiddenException(
        'La Empresa Revendedora configurada para el bot está suspendida.',
      );
    }

    this.contexto.set({ operadorPrincipalId: empresa.operadorPrincipalId });
    return true;
  }

  /**
   * Comparación en tiempo constante para no filtrar la longitud ni el prefijo
   * de la API key por diferencias de tiempo de respuesta.
   */
  private claveValida(esperada: string, recibida: string): boolean {
    const a = Buffer.from(esperada);
    const b = Buffer.from(recibida);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
