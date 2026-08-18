import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

/** Claims que nos interesan del access token emitido por Auth0. */
export interface JwtPayload {
  sub: string;
  email?: string;
  /** Claims custom que puede agregar una Action de Auth0 (opcional). */
  [claim: string]: unknown;
}

/**
 * Validación del access token de Auth0.
 *
 * No guardamos contraseñas: la autenticación vive en Auth0 y acá sólo se verifica
 * la firma del token contra el JWKS público del tenant. El mapeo "usuario de
 * Auth0 → Team Member de IPTVControl (tenant + rol)" lo hace TeamMemberGuard,
 * que es la fuente de verdad de permisos: si alguien manipulara los claims del
 * token, igual no obtendría permisos que la base no tenga registrados.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private static readonly logger = new Logger(JwtStrategy.name);

  constructor(config: ConfigService) {
    const domain = config.get<string>('auth0.domain') ?? '';
    const audience = config.get<string>('auth0.audience') ?? '';
    const issuer = config.get<string>('auth0.issuerUrl') ?? `https://${domain}/`;

    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `https://${domain}/.well-known/jwks.json`,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: audience || undefined,
      issuer,
      algorithms: ['RS256'],
    });

    if (!domain) {
      JwtStrategy.logger.warn(
        'AUTH0_DOMAIN no está configurado: la validación de tokens va a fallar. ' +
          'Sólo tiene sentido en un entorno de desarrollo sin Auth0.',
      );
    }
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
