import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { crearProteccionSwagger } from './common/auth/swagger.guard';

/**
 * Punto de entrada del backend de IPTVControl.
 *
 * Decisiones que se ven acá:
 *  - Prefijo global `/api/v1`: deja lugar a una v2 sin romper clientes, y a la
 *    API pública para Empresas Revendedoras de la fase 2 (docs/04, sección 8),
 *    que va a colgarse de los mismos servicios con controllers nuevos.
 *  - Swagger en `/api/docs`, sólo con login: la documentación técnica de la API
 *    no es información pública.
 *  - `whitelist` + `forbidNonWhitelisted` en el ValidationPipe: si llega un campo
 *    que ningún DTO declara, se rechaza. En un sistema que maneja datos de
 *    terceros, es mejor cortar que "adivinar" qué quiso decir el cliente.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());

  app.enableCors({
    origin: config.get<string[]>('corsOrigins') ?? [],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // --- Swagger / OpenAPI ----------------------------------------------------
  // La documentación se expone sólo con login. Si no hay credenciales
  // configuradas en producción, directamente no se publica.
  const proteccionSwagger = crearProteccionSwagger({
    usuario: config.get<string>('swagger.usuario'),
    password: config.get<string>('swagger.password'),
    esProduccion: config.get<string>('nodeEnv') === 'production',
  });

  const documentoSwagger = new DocumentBuilder()
    .setTitle('IPTVControl API')
    .setDescription(
      'API de IPTVControl — plataforma multi-tenant de gestión de reventa de cuentas IPTV, ' +
        'desarrollada por TECNOLOGIA ACTIVA S.A.S.\n\n' +
        'Convenciones:\n' +
        '- Las rutas usan nombres genéricos en inglés (`/customers`, `/devices`), mientras que el ' +
        'modelo de datos y la lógica de negocio usan el glosario oficial en español ' +
        '(`Cliente Final`, `Dispositivo`).\n' +
        '- El multi-tenancy es invisible en la URL: la misma ruta sirve al panel del Operador ' +
        'Principal y al de una Empresa Revendedora, y el scope de datos lo define el token.\n' +
        '- Los filtros van como query params, y `format=csv` cambia el formato de la respuesta ' +
        'en lugar de exponer una ruta paralela de exportación.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token de Auth0' },
      'bearer',
    )
    .addTag('dashboard', 'KPIs y salud de la integración con el proveedor')
    .addTag('resellers', 'Empresas Revendedoras')
    .addTag('accounts', 'Cuentas en el proveedor')
    .addTag('customers', 'Clientes Finales')
    .addTag('devices', 'Dispositivos')
    .addTag('commercial-plans', 'Modalidades comerciales y precios')
    .addTag('providers', 'Proveedores de contenido')
    .addTag('team-members', 'Logins con permisos sobre los paneles')
    .addTag('settings', 'Menú de parametrización')
    .addTag('audit-log', 'Registro de auditoría')
    .addTag('reports', 'Reportes de consumo')
    .addTag('health', 'Estado del servicio')
    .build();

  if (proteccionSwagger) {
    app.use(['/api/docs', '/api/docs-json'], proteccionSwagger);
    const documento = SwaggerModule.createDocument(app, documentoSwagger);
    SwaggerModule.setup('api/docs', app, documento, {
      swaggerOptions: { persistAuthorization: true },
      customSiteTitle: 'IPTVControl — API',
      jsonDocumentUrl: 'api/docs-json',
    });
  }

  const puerto = config.get<number>('port') ?? 3000;
  await app.listen(puerto, '0.0.0.0');

  logger.log(`IPTVControl backend escuchando en el puerto ${puerto}`);
  logger.log(
    proteccionSwagger
      ? 'Documentación de la API disponible en /api/docs'
      : 'Documentación de la API no expuesta (falta configurar SWAGGER_USER / SWAGGER_PASSWORD)',
  );
}

void bootstrap();
