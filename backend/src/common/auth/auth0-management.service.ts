import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ManagementClient } from 'auth0';
import { randomUUID } from 'node:crypto';

export interface InvitacionTeamMember {
  auth0UserId: string;
  /** URL de un solo uso donde el invitado elige su propia contraseña. */
  urlInvitacion: string;
  expiraEnSegundos: number;
}

/**
 * Provisioning de Team Members en Auth0 (docs/04_Esqueleto_Tecnico_Inicial.md,
 * sección 4.7).
 *
 * Mecanismo: se crea el usuario con una contraseña aleatoria descartable (Auth0
 * la exige, nunca se comunica a nadie) y luego se genera un *Password Change
 * Ticket*: un link de un solo uso, con vencimiento, donde la persona elige su
 * contraseña. Resultado: ni IPTVControl ni el Operador Principal conocen nunca
 * la contraseña del invitado.
 *
 * El email con ese link lo manda IPTVControl con su propio servicio de mail
 * (queda pendiente definir cuál con Federico — docs/05, sección 2), no la
 * plantilla nativa de Auth0, para mantener la marca del producto.
 */
@Injectable()
export class Auth0ManagementService {
  private readonly logger = new Logger(Auth0ManagementService.name);
  private client?: ManagementClient;

  constructor(private readonly config: ConfigService) {}

  /** true si hay credenciales de Management API configuradas. */
  get habilitado(): boolean {
    return Boolean(
      this.config.get<string>('auth0.domain') &&
      this.config.get<string>('auth0.mgmtClientId') &&
      this.config.get<string>('auth0.mgmtClientSecret'),
    );
  }

  /**
   * Crea el usuario en Auth0 y devuelve el link de invitación.
   *
   * `metadata` viaja como `app_metadata`, para que una Action de Auth0 pueda
   * exponerla como claim custom del token si en algún momento hace falta. La
   * fuente de verdad de permisos, igual, sigue siendo la tabla `team_member`.
   */
  async crearInvitacion(
    email: string,
    metadata: Record<string, unknown>,
  ): Promise<InvitacionTeamMember> {
    const client = this.obtenerCliente();
    const ttl = this.config.get<number>('auth0.invitationTtlSec') ?? 259200;

    try {
      const usuario = await client.users.create({
        connection:
          this.config.get<string>('auth0.dbConnection') ?? 'Username-Password-Authentication',
        email,
        // Descartable: el invitado nunca la usa, elige la suya con el ticket.
        password: `${randomUUID()}Aa1!`,
        email_verified: false,
        app_metadata: metadata,
      });

      const auth0UserId = usuario.data.user_id;
      const ticket = await this.generarTicket(auth0UserId, ttl);

      return { auth0UserId, urlInvitacion: ticket, expiraEnSegundos: ttl };
    } catch (error) {
      throw this.traducirError(error, `No se pudo crear la invitación para ${email}.`);
    }
  }

  /**
   * Regenera el link para un usuario que ya existe en Auth0 (botón "Reenviar
   * invitación" del panel, para cuando el link venció o el mail se perdió).
   */
  async reenviarInvitacion(auth0UserId: string): Promise<InvitacionTeamMember> {
    const ttl = this.config.get<number>('auth0.invitationTtlSec') ?? 259200;
    const ticket = await this.generarTicket(auth0UserId, ttl);
    return { auth0UserId, urlInvitacion: ticket, expiraEnSegundos: ttl };
  }

  /** Deshabilita el login de un Team Member dado de baja. */
  async bloquearUsuario(auth0UserId: string): Promise<void> {
    if (!this.habilitado) {
      this.logger.warn(
        `Auth0 Management API no configurada: no se pudo bloquear ${auth0UserId}. ` +
          'Hay que bloquearlo manualmente desde el dashboard de Auth0.',
      );
      return;
    }
    try {
      await this.obtenerCliente().users.update({ id: auth0UserId }, { blocked: true });
    } catch (error) {
      throw this.traducirError(error, `No se pudo bloquear el usuario ${auth0UserId} en Auth0.`);
    }
  }

  private async generarTicket(auth0UserId: string, ttlSec: number): Promise<string> {
    const client = this.obtenerCliente();
    const resultUrl = `${this.config.get<string>('appPublicUrl')}/welcome`;
    try {
      const ticket = await client.tickets.changePassword({
        user_id: auth0UserId,
        result_url: resultUrl,
        ttl_sec: ttlSec,
      });
      return ticket.data.ticket;
    } catch (error) {
      throw this.traducirError(error, 'No se pudo generar el link de invitación en Auth0.');
    }
  }

  private obtenerCliente(): ManagementClient {
    if (!this.habilitado) {
      throw new ServiceUnavailableException(
        'La integración con Auth0 no está configurada (AUTH0_MGMT_CLIENT_ID / SECRET). ' +
          'No se pueden generar invitaciones de Team Members.',
      );
    }
    if (!this.client) {
      this.client = new ManagementClient({
        domain: this.config.get<string>('auth0.domain')!,
        clientId: this.config.get<string>('auth0.mgmtClientId')!,
        clientSecret: this.config.get<string>('auth0.mgmtClientSecret')!,
      });
    }
    return this.client;
  }

  private traducirError(error: unknown, mensaje: string): Error {
    const detalle = error instanceof Error ? error.message : String(error);
    this.logger.error(`${mensaje} Detalle: ${detalle}`);
    return new ServiceUnavailableException(mensaje);
  }
}
