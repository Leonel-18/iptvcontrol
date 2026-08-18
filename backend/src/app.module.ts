import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { configuration, validateConfig } from './common/config/configuration';
import { ContextModule } from './common/context/context.module';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { CryptoModule } from './common/crypto/crypto.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { AuthModule } from './common/auth/auth.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { TeamMemberGuard } from './common/auth/team-member.guard';
import { HttpExceptionFilter } from './common/errors/http-exception.filter';

import { ProveedorModule } from './proveedor/proveedor.module';
import { QueuesModule } from './queues/queues.module';

import { HealthModule } from './modules/health/health.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CuentasModule } from './modules/cuentas/cuentas.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { DispositivosModule } from './modules/dispositivos/dispositivos.module';
import { RevendedorasModule } from './modules/revendedoras/revendedoras.module';
import { ModalidadesModule } from './modules/modalidades/modalidades.module';
import { TeamMembersModule } from './modules/team-members/team-members.module';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { ReportesModule } from './modules/reportes/reportes.module';

/**
 * Módulo raíz de IPTVControl.
 *
 * Orden de defensa de cada request:
 *   1. `RequestContextMiddleware` abre el contexto asincrónico.
 *   2. `ThrottlerGuard` limita el abuso de la API propia.
 *   3. `JwtAuthGuard` valida el token de Auth0.
 *   4. `TeamMemberGuard` resuelve el Team Member y fija el tenant.
 *   5. Row-Level Security filtra las filas en Postgres.
 *
 * Los pasos 4 y 5 son las dos capas del aislamiento multi-tenant: si falla el
 * scope de la aplicación, la base igual no devuelve datos de otro tenant.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: (config) => {
        validateConfig(configuration());
        return config;
      },
    }),

    // Rate limiting de la API propia (distinto del limitador contra SENSA).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => ({
        throttlers: [{ ttl: 60_000, limit: 300 }],
      }),
    }),

    // Infraestructura transversal (todos globales).
    ContextModule,
    PrismaModule,
    CryptoModule,
    AuditModule,
    AuthModule,
    QueuesModule,
    ProveedorModule,

    // Módulos de negocio.
    HealthModule,
    DashboardModule,
    CuentasModule,
    ClientesModule,
    DispositivosModule,
    RevendedorasModule,
    ModalidadesModule,
    TeamMembersModule,
    ConfiguracionModule,
    AuditoriaModule,
    ReportesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TeamMemberGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
