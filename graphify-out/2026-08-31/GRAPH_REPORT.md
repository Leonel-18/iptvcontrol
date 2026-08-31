# Graph Report - iptvcontrol-opencode  (2026-08-27)

## Corpus Check
- 210 files · ~128,400 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1836 nodes · 4280 edges · 131 communities (96 shown, 35 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aea79b4f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- RequestContextService
- SensaAdapter
- sensa.adapter.ts
- devDependencies
- dependencies
- scripts
- compilerOptions
- IPTVControl — Esqueleto Técnico Inicial
- IPTVControl — Reglas de Negocio
- Auth0ManagementService
- CryptoService
- PaginationQueryDto
- ProveedorAdapter
- Entidades (modelo de datos)
- IPTVControl — URL Structure / Routing Convention
- migration.sql
- migration.sql
- decorators.ts
- IPTVControl
- IPTVControl — Decisiones Pendientes (consolidado)
- exclude
- IPTVControl — Instrucciones del Proyecto
- instructions
- nest-cli.json
- Instructivo — Cargar IPTVControl en OpenCode
- configuration.ts
- csv.util.ts
- docker-entrypoint.sh
- 01-app-user.sh
- ActualizarConexionProveedorDto
- primitives.tsx
- ColaProveedorService
- CrearModalidadDto
- revendedoras.service.ts
- dependencies
- Capacidad de una Cuenta
- api
- Integración con SENSA
- compilerOptions
- clientes.service.ts
- common.tsx
- Dashboard.tsx
- DispositivosController
- ListarAuditoriaQueryDto
- CustomerDetail.tsx
- CommercialPlanList.tsx
- CustomerDetail.tsx
- SoloRevendedor
- types.ts
- app.module.ts
- .transaction
- Decisiones pendientes
- CrearClienteDto
- dispositivos.controller.ts
- .consumo
- Despliegue y operación
- jest
- LandingPage.tsx
- Flujo — Alta de Cliente Final
- HealthController
- devDependencies
- sensa.adapter.spec.ts
- cuentas.mapper.ts
- CrearTeamMemberDto
- Registro de auditoría
- TeamMembersController
- RequestContextMiddleware
- clientes.controller.ts
- JwtAuthGuard
- scripts
- app.json
- IPTVControl
- package.json
- package.json
- IPTVControl — Índice del vault
- seed-root.ts
- @nestjs/platform-express
- Vault de Obsidian — IPTVControl
- AuditModule
- team-members.service.ts
- utils.ts
- vite-env.d.ts
- Auth0ManagementService
- compression
- ioredis
- @nestjs/bullmq
- @nestjs/common
- @nestjs/config
- @nestjs/swagger
- @nestjs/throttler
- passport-jwt
- rxjs
- team-members.module.ts
- ClientesService
- eslint-plugin-react-refresh
- globals
- jsdom
- postcss
- @testing-library/jest-dom
- @testing-library/react
- @types/node
- @types/react
- typescript
- crearProteccionSwagger
- @vitejs/plugin-react
- vitest
- DashboardController
- ColaProveedorService
- generarCsv
- Auth0ManagementService
- CuentasProvisioningService
- HttpExceptionFilter
- ListarCuentasQueryDto
- InventarioProveedorService
- migration.sql
- auth0
- migration.sql
- autoprefixer
- @nestjs/platform-express
- vite

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 63 edges
2. `RequestContextService` - 57 edges
3. `api()` - 57 edges
4. `ProveedorService` - 46 edges
5. `cn()` - 37 edges
6. `AuditService` - 36 edges
7. `traducir()` - 36 edges
8. `useSesion()` - 33 edges
9. `SensaAdapter` - 31 edges
10. `Button` - 27 edges

## Surprising Connections (you probably didn't know these)
- `MenuUsuario()` --calls--> `useSesion()`  [EXTRACTED]
  frontend/src/components/layout/AppLayout.tsx → frontend/src/lib/session.tsx
- `DeviceDetailData` --inherits--> `AccountDevice`  [EXTRACTED]
  frontend/src/features/devices/DeviceDetail.tsx → frontend/src/lib/types.ts
- `ReassignDialog()` --calls--> `api()`  [EXTRACTED]
  frontend/src/features/devices/DeviceDetail.tsx → frontend/src/lib/api.ts
- `bootstrap()` --indirect_call--> `AppModule`  [INFERRED]
  backend/src/main.ts → backend/src/app.module.ts
- `IncidenciasDispositivosController` --references--> `SoloRevendedor()`  [EXTRACTED]
  backend/src/modules/dispositivos/incidencias-dispositivos.controller.ts → backend/src/common/auth/decorators.ts

## Import Cycles
- None detected.

## Communities (131 total, 35 thin omitted)

### Community 0 - "RequestContextService"
Cohesion: 0.07
Nodes (12): AuditService, Injectable, TeamMemberGuard, Injectable, RequestContextService, Injectable, PaginatedResponse, PrismaService (+4 more)

### Community 2 - "sensa.adapter.ts"
Cohesion: 0.12
Nodes (9): DniRepetidoError, EmailRepetidoError, ProveedorNoDisponibleError, ProveedorValidacionError, ReintentosDniAgotadosError, ProveedorTelemetryService, Injectable, ProveedorRateLimiterService (+1 more)

### Community 3 - "devDependencies"
Cohesion: 0.04
Nodes (45): devDependencies, eslint, eslint-config-prettier, eslint-plugin-prettier, jest, @nestjs/cli, @nestjs/schematics, @nestjs/testing (+37 more)

### Community 4 - "dependencies"
Cohesion: 0.09
Nodes (23): auth0, dependencies, auth0, bullmq, class-transformer, class-validator, helmet, jwks-rsa (+15 more)

### Community 5 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, build, format, lint, lint:fix, prisma:generate, prisma:migrate, prisma:migrate:dev (+9 more)

### Community 6 - "compilerOptions"
Cohesion: 0.07
Nodes (30): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+22 more)

### Community 7 - "IPTVControl — Esqueleto Técnico Inicial"
Cohesion: 0.08
Nodes (25): 1. Entidades principales (borrador de modelo de datos), 2.1. Stack técnico confirmado, 2.2. Relaciones entre entidades, 2. Relaciones clave, 3.1. Identificadores requeridos por SENSA, 3. Integración con el Proveedor (SENSA) — patrón de conector desacoplado, 4.1. Alta de Cliente Final — dos métodos, 4.2. Baja definitiva de Cliente Final (+17 more)

### Community 8 - "IPTVControl — Reglas de Negocio"
Cohesion: 0.08
Nodes (25): 10. Sobre el documento de tareas de Federico, 11. Registro de auditoría (Audit Log), 12. Alerta de Cuenta cerca del tope de capacidad, 13. Exportación de datos propios a CSV, 14. Datos registrados de la Empresa Revendedora, 1.1. Al menudeo (sin obligación de ventas mensuales), 1.2. Con obligación de ventas mensuales (escala creciente, ej. X5 / X10), 1.3. Precios (+17 more)

### Community 9 - "Auth0ManagementService"
Cohesion: 0.07
Nodes (25): Auth0ManagementService, InvitacionTeamMember, Injectable, CrearTeamMemberDto, ListarTeamMembersQueryDto, ApiProperty, ApiPropertyOptional, IsEmail (+17 more)

### Community 10 - "CryptoService"
Cohesion: 0.10
Nodes (8): CryptoService, Injectable, TransactionClient, IdentificadoresService, Injectable, ConfiguracionProveedorService, Injectable, Inject

### Community 11 - "PaginationQueryDto"
Cohesion: 0.11
Nodes (16): PaginationQueryDto, ApiPropertyOptional, IsIn, IsInt, IsOptional, IsString, Max, Min (+8 more)

### Community 12 - "ProveedorAdapter"
Cohesion: 0.17
Nodes (10): ProveedoresController, ApiOperation, ApiTags, Controller, Get, Param, Post, SoloOperador (+2 more)

### Community 13 - "Entidades (modelo de datos)"
Cohesion: 0.14
Nodes (13): Actores (roles de negocio), Cliente Final, Cuenta (Cuenta SENSA), Dispositivo, Empresa Revendedora, Entidades (modelo de datos), IPTVControl — Glosario de Actores y Entidades, Modalidad Comercial (+5 more)

### Community 14 - "IPTVControl — URL Structure / Routing Convention"
Cohesion: 0.14
Nodes (13): 1. Principios aplicados, 2. Tabla de rutas, 3. Ejemplos de rutas anidadas resueltas por query param (no por segmento), 4.1. Convención de nombres de componentes, 4.2. Dónde vive el mapeo español↔inglés en el código, 4.3. `/users` → `/team-members`: por qué el cambio de nombre, 4.4. Excepción a la ruta `/team-members`: el primer Team Member root, 4. Decisión confirmada por Bruno: inglés en URLs y en componentes de UI (+5 more)

### Community 15 - "migration.sql"
Cohesion: 0.15
Nodes (9): "audit_log", "cliente_final", "configuracion_proveedor", "cuenta", "dispositivo", "empresa_revendedora", "llamada_proveedor", "modalidad_comercial" (+1 more)

### Community 16 - "migration.sql"
Cohesion: 0.44
Nodes (11): "audit_log", "cliente_final", "configuracion_proveedor", "cuenta", "dispositivo", "empresa_revendedora", "llamada_proveedor", "modalidad_comercial" (+3 more)

### Community 17 - "decorators.ts"
Cohesion: 0.19
Nodes (4): CredencialesProveedor, DispositivoProveedor, SensaAdapter, Injectable

### Community 18 - "IPTVControl"
Cohesion: 0.17
Nodes (11): Decisiones pendientes / a confirmar, Documentación relacionada, Equipo, Estructura del repositorio (implementada), Fuente descartada, Herramientas de contexto: Graphify y el vault de Obsidian, Identidad visual, IPTVControl (+3 more)

### Community 19 - "IPTVControl — Decisiones Pendientes (consolidado)"
Cohesion: 0.20
Nodes (9): 1. Comercial / negocio, 2. Autenticación y provisioning (Auth0), 3. Seguridad de datos sensibles, 4. Integración SENSA — casos límite, 5. Parametrización — umbrales y validaciones, 6. Menú de Parametrización — conexión SENSA (`04_Esqueleto_Tecnico_Inicial.md`, sección 9), 7. Documentación / infraestructura de trabajo, 8. Fuente descartada — recordatorio (+1 more)

### Community 20 - "exclude"
Cohesion: 0.22
Nodes (8): exclude, extends, dist, node_modules, test, prisma/seed-root.ts, **/*spec.ts, ./tsconfig.json

### Community 21 - "IPTVControl — Instrucciones del Proyecto"
Cohesion: 0.22
Nodes (8): Alcance del MVP (primera etapa), Cómo quiero que Claude me responda en este Proyecto, Datos de la empresa (para cotizaciones, informes o material formal derivado de este proyecto), Documentos que forman parte de este Proyecto, Infraestructura y equipo de desarrollo, IPTVControl — Instrucciones del Proyecto, Qué es este proyecto, Stack tecnológico

### Community 22 - "instructions"
Cohesion: 0.22
Nodes (8): instructions, $schema, docs/01_Instrucciones_del_Proyecto.md, docs/02_Glosario_de_Actores_y_Entidades.md, docs/03_Reglas_de_Negocio.md, docs/04_Esqueleto_Tecnico_Inicial.md, docs/05_Decisiones_Pendientes.md, docs/IPTVControl_URL_Routing_Convention.md

### Community 23 - "nest-cli.json"
Cohesion: 0.25
Nodes (7): collection, compilerOptions, deleteOutDir, plugins, tsConfigPath, $schema, sourceRoot

### Community 24 - "Instructivo — Cargar IPTVControl en OpenCode"
Cohesion: 0.21
Nodes (11): RegistroAuditoria, RequestContext, CrearCuentaOpciones, SinCapacidadEnCuentaError, ClasificacionDispositivoProveedor, DispositivoInventarioDto, InventarioProveedorDto, ConfiguracionProveedorResuelta (+3 more)

### Community 25 - "configuration.ts"
Cohesion: 0.12
Nodes (15): 1. ¿Qué es IPTVControl y en qué estado está?, 2. Stack y topología actuales (Docker Compose local), 3. Variables de entorno, 4.1. Primer despliegue en una VPS nueva, 4.2. Actualización de código, 4.3. Cambio de datos de conexión SENSA / planes / modalidades, 4. Procedimientos de arranque / mantenimiento, 5.1. Dominio, DNS y HTTPS (+7 more)

### Community 26 - "csv.util.ts"
Cohesion: 0.22
Nodes (8): generarCsv(), responderCsv(), Fila, Query, Res, CambiarPasswordCuentaDto, ApiProperty, Matches

### Community 30 - "ActualizarConexionProveedorDto"
Cohesion: 0.09
Nodes (26): ConfiguracionController, ApiOperation, ApiTags, Body, Controller, Get, Patch, Post (+18 more)

### Community 31 - "primitives.tsx"
Cohesion: 0.21
Nodes (17): ResellerStatusBadge(), TeamMemberStatusBadge(), DialogContent(), Select(), Field(), Input, ChangePlanDialog(), ResellerForm() (+9 more)

### Community 32 - "ColaProveedorService"
Cohesion: 0.21
Nodes (10): DatosCerrarCuenta, DatosEliminarDispositivo, DatosReconciliarDispositivos, DatosSincronizarContadoresVenta, DatosSondearVinculacion, OPCIONES_REINTENTO, TRABAJOS_PROVEEDOR, ColaProveedorService (+2 more)

### Community 33 - "CrearModalidadDto"
Cohesion: 0.08
Nodes (31): ActualizarModalidadDto, CrearModalidadDto, ListarModalidadesQueryDto, ApiProperty, ApiPropertyOptional, IsDateString, IsEnum, IsInt (+23 more)

### Community 34 - "revendedoras.service.ts"
Cohesion: 0.05
Nodes (35): ClientesService, Injectable, InventarioProveedorService, Injectable, ActualizarRevendedoraDto, CambiarModalidadDto, CrearRevendedoraDto, ListarRevendedorasQueryDto (+27 more)

### Community 35 - "dependencies"
Cohesion: 0.04
Nodes (45): @auth0/auth0-react, class-variance-authority, clsx, date-fns, dependencies, @auth0/auth0-react, class-variance-authority, clsx (+37 more)

### Community 36 - "Capacidad de una Cuenta"
Cohesion: 0.05
Nodes (38): Alerta de "cerca del tope", Baja y suspensión, Capacidad de una Cuenta, Cómo se decide dónde entra un alta, Cómo se ve en el panel, Descubrimiento después del primer login, El mecanismo real de bloqueo: contadores nativos de SENSA, Límite real de los contadores de SENSA (confirmado 21/08/2026) (+30 more)

### Community 37 - "api"
Cohesion: 0.11
Nodes (40): AppLayout(), NotFound(), RequiereSesion(), SoloOperador(), SoloRevendedora(), AccountDetail(), AccountList(), AuditLogList() (+32 more)

### Community 38 - "Integración con SENSA"
Cohesion: 0.06
Nodes (32): Aislamiento multi-tenant, Cómo se activa el contexto, Dos capas de defensa, Qué ve el Operador Principal (tabla normativa), Ver también, Verificación, Casos especiales, Cola de reintentos (BullMQ) (+24 more)

### Community 39 - "compilerOptions"
Cohesion: 0.07
Nodes (29): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+21 more)

### Community 40 - "clientes.service.ts"
Cohesion: 0.25
Nodes (6): CODIGOS_DNI_REPETIDO, CODIGOS_EMAIL_REPETIDO, CODIGOS_TRANSITORIOS, CODIGOS_VALIDACION, SENSA_CODIGOS, SensaEnvelope

### Community 41 - "common.tsx"
Cohesion: 0.14
Nodes (25): ProviderDeviceClassBadge(), tonoPorEstado, VinculacionEnCursoAlert(), AuditLogEntry(), DetalleItem(), formatearValor(), humanizar(), accountStatusLabels (+17 more)

### Community 42 - "Dashboard.tsx"
Cohesion: 0.11
Nodes (16): ResolverIncidenciaDto, ApiProperty, ApiPropertyOptional, IsIn, IsOptional, IsUUID, IncidenciasDispositivosController, ApiOperation (+8 more)

### Community 43 - "DispositivosController"
Cohesion: 0.16
Nodes (12): DispositivosController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+4 more)

### Community 44 - "ListarAuditoriaQueryDto"
Cohesion: 0.10
Nodes (18): AuditoriaController, ApiOperation, ApiTags, Controller, Get, Query, Res, AuditoriaModule (+10 more)

### Community 45 - "CustomerDetail.tsx"
Cohesion: 0.11
Nodes (24): ALTURAS_BARRA, CapacityMeter(), OcupacionCuenta, ItemMenu, ITEMS, MenuUsuario(), NavItems(), DropdownMenuContent() (+16 more)

### Community 46 - "CommercialPlanList.tsx"
Cohesion: 0.20
Nodes (27): AccountStatusBadge(), CopyableId(), CustomerStatusBadge(), DeviceStatusBadge(), DeviceTypeBadge(), ExportCsvButton(), SecretValue(), WhatsappTemplateButton() (+19 more)

### Community 47 - "CustomerDetail.tsx"
Cohesion: 0.17
Nodes (26): DetailRow(), Metric(), PageHeader(), Alert(), Badge(), BadgeProps, badgeVariants, BotonProps (+18 more)

### Community 48 - "SoloRevendedor"
Cohesion: 0.16
Nodes (12): ClientesController, ApiOperation, ApiQuery, ApiTags, Body, Controller, Get, Param (+4 more)

### Community 49 - "types.ts"
Cohesion: 0.06
Nodes (34): HealthBadge(), CardFooter(), EstadoFormulario, INICIAL, LEYENDAS_ALTA, MetodoAlta, PASOS, IntegrationHealthPanel() (+26 more)

### Community 50 - "app.module.ts"
Cohesion: 0.20
Nodes (14): ClientesModule, Module, ConfiguracionModule, Module, CuentasModule, Module, DashboardModule, Module (+6 more)

### Community 51 - ".transaction"
Cohesion: 0.25
Nodes (9): CuentasController, ApiOperation, ApiTags, Body, Controller, Get, Param, Patch (+1 more)

### Community 52 - "Decisiones pendientes"
Cohesion: 0.11
Nodes (17): 1 · Comercial, 2 · Autenticación y provisioning (Auth0), 3 · Seguridad de datos sensibles, 4 · Integración SENSA — casos límite, 5 · Parametrización — umbrales y validaciones, 6 · Menú de Parametrización, 7 · Documentación, Decisiones pendientes (+9 more)

### Community 53 - "CrearClienteDto"
Cohesion: 0.14
Nodes (17): ArrayUnique, CrearClienteDto, DispositivoAltaDto, ApiProperty, ApiPropertyOptional, IsBoolean, IsEmail, IsEnum (+9 more)

### Community 54 - "dispositivos.controller.ts"
Cohesion: 0.33
Nodes (12): CsvDispositivo, ActualizarDispositivoDto, CrearDispositivoDto, ListarDispositivosQueryDto, ReasignarDispositivoDto, ApiProperty, ApiPropertyOptional, IsEnum (+4 more)

### Community 56 - "Despliegue y operación"
Cohesion: 0.12
Nodes (15): Arranque en frío y seed, El problema del huevo y la gallina, El seed, Invitación del resto del equipo, Salvaguarda del último administrador, Ver también, Backups, Despliegue y operación (+7 more)

### Community 57 - "jest"
Cohesion: 0.13
Nodes (15): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+7 more)

### Community 58 - "LandingPage.tsx"
Cohesion: 0.15
Nodes (11): ThemeToggle(), Cargando(), capabilities, LandingPage(), steps, ThemeToggle(), ContextoTema, ProveedorDeTema() (+3 more)

### Community 59 - "Flujo — Alta de Cliente Final"
Cohesion: 0.15
Nodes (11): Descubrimiento del Dispositivo, El identificador tipo DNI, Flujo — Alta de Cliente Final, Los cuatro pasos del asistente, Los dos métodos de alta, Si el Proveedor falla, Ver también, Flujo — Dispositivo adicional sin migración imposible (+3 more)

### Community 60 - "HealthController"
Cohesion: 0.19
Nodes (9): ApiExcludeEndpoint, Public(), HealthController, ApiOperation, ApiTags, Controller, Get, HealthModule (+1 more)

### Community 61 - "devDependencies"
Cohesion: 0.15
Nodes (13): @eslint/js, eslint-plugin-react-hooks, devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, tailwindcss, @types/react-dom (+5 more)

### Community 62 - "sensa.adapter.spec.ts"
Cohesion: 0.29
Nodes (6): CorregirVinculacionDto, ApiProperty, ApiPropertyOptional, IsIn, IsOptional, IsUUID

### Community 63 - "cuentas.mapper.ts"
Cohesion: 0.13
Nodes (18): CoincidenciaGestionExterna, armarCategoria(), calcularCapacidad(), CapacidadCategoria, contarDispositivosCliente(), contarOcupados(), contarVentasActivas(), CuentaCapacidadInput (+10 more)

### Community 64 - "CrearTeamMemberDto"
Cohesion: 0.31
Nodes (10): CapacidadCuenta, armarOcupacion(), CuentaOperadorDto, CuentaRevendedoraDto, mapCuentaParaOperador(), mapCuentaParaRevendedora(), nombresDeServicios(), OcupacionCategoriaDto (+2 more)

### Community 65 - "Registro de auditoría"
Cohesion: 0.15
Nodes (11): Lo que no incluye el MVP, Quién consulta qué, Qué se registra, Registro de auditoría, Regla de oro para escribir en el log, Ver también, Exportación a CSV, La pregunta que responde (+3 more)

### Community 66 - "TeamMembersController"
Cohesion: 0.17
Nodes (11): ReportesController, ApiOperation, ApiQuery, ApiTags, Controller, Get, Query, Res (+3 more)

### Community 67 - "RequestContextMiddleware"
Cohesion: 0.43
Nodes (4): mapDispositivoParaOperador(), mapDispositivoParaRevendedora(), DispositivosQueryService, Injectable

### Community 68 - "clientes.controller.ts"
Cohesion: 0.11
Nodes (5): ActivarDispositivoParams, ActualizarCapacidadParams, ActualizarPasswordParams, PROVEEDOR_ADAPTERS, ServiciosCuenta

### Community 69 - "JwtAuthGuard"
Cohesion: 0.43
Nodes (4): CurrentUser, Roles(), SoloOperador(), SoloRevendedor()

### Community 70 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, lint, lint:fix, preview, test, test:watch (+1 more)

### Community 71 - "app.json"
Cohesion: 0.22
Nodes (8): alwaysUpdateLinks, attachmentFolderPath, defaultViewMode, newLinkFormat, readableLineLength, showLineNumber, strictLineBreaks, useMarkdownLinks

### Community 72 - "IPTVControl"
Cohesion: 0.12
Nodes (16): Acerca de, Aislamiento multi-tenant: cómo está garantizado, Arquitectura de la integración con el proveedor, Comandos habituales, Configurar Auth0 (paso previo al primer login), Convenciones de código (léelo antes de tocar algo), Desarrollo sin Docker, Documentación (+8 more)

### Community 73 - "package.json"
Cohesion: 0.33
Nodes (5): description, license, name, private, version

### Community 74 - "package.json"
Cohesion: 0.33
Nodes (5): description, name, private, type, version

### Community 75 - "IPTVControl — Índice del vault"
Cohesion: 0.33
Nodes (5): Convenciones de este vault, IPTVControl — Índice del vault, Las cinco reglas que más se consultan, Mapa del sistema, Por dónde empezar

### Community 76 - "seed-root.ts"
Cohesion: 0.60
Nodes (4): cifrar(), crearUsuarioAuth0(), main(), prisma

### Community 78 - "Vault de Obsidian — IPTVControl"
Cohesion: 0.40
Nodes (4): Cómo abrirlo, Estructura, Relación con `docs/`, Vault de Obsidian — IPTVControl

### Community 81 - "team-members.service.ts"
Cohesion: 0.50
Nodes (4): AppConfig, configuration(), toInt(), validateConfig()

### Community 84 - "Auth0ManagementService"
Cohesion: 0.33
Nodes (9): OpcionesLlamada, SensaAddUserRequest, SensaCreateDeviceRequest, SensaDevice, SensaDeviceEnvelopeResponse, SensaEditUserRequest, SensaLicensesResponse, SensaUser (+1 more)

### Community 87 - "@nestjs/bullmq"
Cohesion: 0.60
Nodes (5): "cuenta", "dispositivo", "incidencia_dispositivo_proveedor", "reserva_tecnica_dispositivo", "solicitud_vinculacion_dispositivo"

### Community 94 - "team-members.module.ts"
Cohesion: 0.16
Nodes (9): AuthModule, Module, JwtPayload, JwtStrategy, Injectable, RevendedorasModule, Module, TeamMembersModule (+1 more)

### Community 95 - "ClientesService"
Cohesion: 0.67
Nodes (3): AuditModule, Global, Module

### Community 105 - "crearProteccionSwagger"
Cohesion: 0.31
Nodes (7): AppModule, Module, crearProteccionSwagger(), iguales(), logger, OpcionesSwagger, bootstrap()

### Community 115 - "DashboardController"
Cohesion: 0.16
Nodes (9): DashboardController, ApiOperation, ApiTags, Controller, Get, Post, SoloOperador, DashboardService (+1 more)

### Community 117 - "generarCsv"
Cohesion: 0.24
Nodes (10): ColumnaCsv, CsvCliente, ActualizarClienteDto, ListarClientesQueryDto, ApiPropertyOptional, IsEnum, IsOptional, IsString (+2 more)

### Community 118 - "Auth0ManagementService"
Cohesion: 0.67
Nodes (3): ContextModule, Global, Module

### Community 121 - "ListarCuentasQueryDto"
Cohesion: 0.67
Nodes (3): CryptoModule, Global, Module

### Community 122 - "InventarioProveedorService"
Cohesion: 0.67
Nodes (3): PrismaModule, Global, Module

### Community 125 - "auth0"
Cohesion: 0.67
Nodes (3): QueuesModule, Global, Module

## Knowledge Gaps
- **496 isolated node(s):** `docker-entrypoint.sh script`, `$schema`, `collection`, `sourceRoot`, `deleteOutDir` (+491 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `RequestContextService` to `ColaProveedorService`, `revendedoras.service.ts`, `CryptoService`, `CuentasProvisioningService`, `Instructivo — Cargar IPTVControl en OpenCode`, `HealthController`, `cuentas.mapper.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `RequestContextService` connect `RequestContextService` to `ColaProveedorService`, `CryptoService`, `SoloRevendedor`, `CuentasProvisioningService`, `generarCsv`, `.consumo`, `Instructivo — Cargar IPTVControl en OpenCode`, `HttpExceptionFilter`, `cuentas.mapper.ts`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `Auth0ManagementService` connect `Auth0ManagementService` to `RequestContextService`, `team-members.module.ts`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `docker-entrypoint.sh script`, `$schema`, `collection` to the rest of the system?**
  _496 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `RequestContextService` be split into smaller, more focused modules?**
  _Cohesion score 0.07111756168359942 - nodes in this community are weakly interconnected._
- **Should `sensa.adapter.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11594202898550725 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._