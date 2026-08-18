/**
 * Configuración centralizada leída de variables de entorno.
 *
 * Criterio: ningún módulo lee `process.env` directamente — todos piden los
 * valores a `ConfigService`. Así hay un solo lugar donde ver qué necesita el
 * sistema para arrancar, y qué valor por defecto toma si falta.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  appPublicUrl: string;
  corsOrigins: string[];
  database: {
    url: string;
    appUser: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  encryption: {
    masterKeyHex: string;
  };
  auth0: {
    domain: string;
    audience: string;
    issuerUrl: string;
    mgmtClientId?: string;
    mgmtClientSecret?: string;
    dbConnection: string;
    invitationTtlSec: number;
  };
  sensa: {
    rateLimitPerMinute: number;
    requestTimeoutMs: number;
    dniMaxRetries: number;
  };
  /** Credenciales de la documentación de la API (Swagger sólo con login). */
  swagger: {
    usuario?: string;
    password?: string;
  };
  seed: {
    operadorNombre: string;
    rootEmail?: string;
    rootAuth0UserId?: string;
    dniInicialSensa: number;
  };
}

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const configuration = (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toInt(process.env.PORT, 3000),
  appPublicUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: {
    url: process.env.DATABASE_URL ?? '',
    appUser: process.env.APP_DB_USER ?? 'iptvcontrol_app',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  encryption: {
    masterKeyHex: process.env.ENCRYPTION_MASTER_KEY ?? '',
  },
  auth0: {
    domain: process.env.AUTH0_DOMAIN ?? '',
    audience: process.env.AUTH0_AUDIENCE ?? '',
    issuerUrl: process.env.AUTH0_ISSUER_URL ?? `https://${process.env.AUTH0_DOMAIN ?? ''}/`,
    mgmtClientId: process.env.AUTH0_MGMT_CLIENT_ID || undefined,
    mgmtClientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET || undefined,
    dbConnection: process.env.AUTH0_DB_CONNECTION ?? 'Username-Password-Authentication',
    invitationTtlSec: toInt(process.env.AUTH0_INVITATION_TTL_SEC, 259200),
  },
  sensa: {
    rateLimitPerMinute: toInt(process.env.SENSA_RATE_LIMIT_PER_MINUTE, 60),
    requestTimeoutMs: toInt(process.env.SENSA_REQUEST_TIMEOUT_MS, 15000),
    dniMaxRetries: toInt(process.env.SENSA_DNI_MAX_RETRIES, 25),
  },
  swagger: {
    usuario: process.env.SWAGGER_USER || undefined,
    password: process.env.SWAGGER_PASSWORD || undefined,
  },
  seed: {
    operadorNombre: process.env.SEED_OPERADOR_NOMBRE ?? 'TECNOLOGIA ACTIVA S.A.S.',
    rootEmail: process.env.SEED_ROOT_EMAIL || undefined,
    rootAuth0UserId: process.env.SEED_ROOT_AUTH0_USER_ID || undefined,
    dniInicialSensa: toInt(process.env.SEED_DNI_INICIAL_SENSA, 30000000),
  },
});

/**
 * Validación de arranque: preferimos que el proceso muera con un mensaje claro
 * antes de levantar el sistema a medias. Este software maneja datos de terceros
 * (Empresas Revendedoras), así que arrancar sin clave de encriptación o sin
 * Auth0 configurado sería peor que no arrancar.
 */
export const validateConfig = (config: AppConfig): void => {
  const errores: string[] = [];

  if (!config.database.url) {
    errores.push('DATABASE_URL es obligatoria.');
  }

  if (!/^[0-9a-fA-F]{64}$/.test(config.encryption.masterKeyHex)) {
    errores.push(
      'ENCRYPTION_MASTER_KEY debe ser una clave de 32 bytes en hexadecimal (64 caracteres). ' +
        'Generar con: openssl rand -hex 32',
    );
  }

  // En desarrollo permitimos trabajar sin Auth0 configurado para poder levantar
  // el backend y revisar Swagger; en producción es un requisito duro.
  if (config.nodeEnv === 'production') {
    if (!config.auth0.domain) errores.push('AUTH0_DOMAIN es obligatoria en producción.');
    if (!config.auth0.audience) errores.push('AUTH0_AUDIENCE es obligatoria en producción.');
  }

  if (errores.length > 0) {
    throw new Error(`Configuración inválida:\n - ${errores.join('\n - ')}`);
  }
};
