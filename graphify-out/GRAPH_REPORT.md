# Graph Report - iptvcontrol-opencode  (2026-08-26)

## Corpus Check
- 207 files · ~125,939 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1815 nodes · 4236 edges · 117 communities (85 shown, 32 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bff7d20e`
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
- eslint-plugin-react-refresh
- globals
- jsdom
- postcss
- @testing-library/jest-dom
- @testing-library/react
- @types/node
- @types/react
- typescript
- @vitejs/plugin-react
- vitest
- ColaProveedorService
- generarCsv
- HttpExceptionFilter
- migration.sql
- vite

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 63 edges
2. `RequestContextService` - 57 edges
3. `api()` - 57 edges
4. `ProveedorService` - 45 edges
5. `cn()` - 37 edges
6. `AuditService` - 36 edges
7. `traducir()` - 36 edges
8. `useSesion()` - 33 edges
9. `SensaAdapter` - 30 edges
10. `Button` - 27 edges

## Surprising Connections (you probably didn't know these)
- `MenuUsuario()` --calls--> `useSesion()`  [EXTRACTED]
  frontend/src/components/layout/AppLayout.tsx → frontend/src/lib/session.tsx
- `CardDescription()` --calls--> `cn()`  [EXTRACTED]
  frontend/src/components/ui/primitives.tsx → frontend/src/lib/utils.ts
- `PanelOperador()` --calls--> `formatearNumero()`  [EXTRACTED]
  frontend/src/features/dashboard/Dashboard.tsx → frontend/src/lib/utils.ts
- `ReassignDialog()` --calls--> `api()`  [EXTRACTED]
  frontend/src/features/devices/DeviceDetail.tsx → frontend/src/lib/api.ts
- `bootstrap()` --indirect_call--> `AppModule`  [INFERRED]
  backend/src/main.ts → backend/src/app.module.ts

## Import Cycles
- None detected.

## Communities (117 total, 32 thin omitted)

### Community 0 - "RequestContextService"
Cohesion: 0.08
Nodes (17): AuditService, RegistroAuditoria, Injectable, TeamMemberGuard, Injectable, RequestContext, RequestContextService, Injectable (+9 more)

### Community 2 - "sensa.adapter.ts"
Cohesion: 0.19
Nodes (6): DniRepetidoError, EmailRepetidoError, ProveedorNoDisponibleError, ProveedorValidacionError, ReintentosDniAgotadosError, SENSA_CODIGOS

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
Cohesion: 0.05
Nodes (32): Auth0ManagementService, InvitacionTeamMember, Injectable, AuthModule, Module, JwtPayload, JwtStrategy, Injectable (+24 more)

### Community 10 - "CryptoService"
Cohesion: 0.08
Nodes (15): CryptoService, Injectable, TransactionClient, CrearCuentaOpciones, SinCapacidadEnCuentaError, IdentificadoresService, Injectable, ConfiguracionProveedorResuelta (+7 more)

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
Cohesion: 0.20
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
Cohesion: 0.24
Nodes (4): ProveedorTelemetryService, Injectable, ProveedorRateLimiterService, Injectable

### Community 25 - "configuration.ts"
Cohesion: 0.12
Nodes (15): 1. ¿Qué es IPTVControl y en qué estado está?, 2. Stack y topología actuales (Docker Compose local), 3. Variables de entorno, 4.1. Primer despliegue en una VPS nueva, 4.2. Actualización de código, 4.3. Cambio de datos de conexión SENSA / planes / modalidades, 4. Procedimientos de arranque / mantenimiento, 5.1. Dominio, DNS y HTTPS (+7 more)

### Community 26 - "csv.util.ts"
Cohesion: 0.22
Nodes (8): CurrentUser, Roles(), SoloOperador(), generarCsv(), responderCsv(), Fila, Res, CsvDispositivo

### Community 30 - "ActualizarConexionProveedorDto"
Cohesion: 0.10
Nodes (25): ConfiguracionController, ApiOperation, ApiTags, Body, Controller, Get, Patch, Post (+17 more)

### Community 31 - "primitives.tsx"
Cohesion: 0.11
Nodes (23): DialogContent(), Button, Field(), ClienteDeLaCuenta, CorrectDeviceBindingDialog(), TeamMemberForm(), roleLabels, ApiError (+15 more)

### Community 32 - "ColaProveedorService"
Cohesion: 0.07
Nodes (24): DashboardController, ApiOperation, ApiTags, Controller, Get, Post, SoloOperador, DashboardService (+16 more)

### Community 33 - "CrearModalidadDto"
Cohesion: 0.09
Nodes (31): ActualizarModalidadDto, CrearModalidadDto, ListarModalidadesQueryDto, ApiProperty, ApiPropertyOptional, IsDateString, IsEnum, IsInt (+23 more)

### Community 34 - "revendedoras.service.ts"
Cohesion: 0.06
Nodes (35): ClientesService, Injectable, InventarioProveedorService, Injectable, ActualizarRevendedoraDto, CambiarModalidadDto, CrearRevendedoraDto, ListarRevendedorasQueryDto (+27 more)

### Community 35 - "dependencies"
Cohesion: 0.04
Nodes (45): @auth0/auth0-react, class-variance-authority, clsx, date-fns, dependencies, @auth0/auth0-react, class-variance-authority, clsx (+37 more)

### Community 36 - "Capacidad de una Cuenta"
Cohesion: 0.05
Nodes (38): Alerta de "cerca del tope", Baja y suspensión, Capacidad de una Cuenta, Cómo se decide dónde entra un alta, Cómo se ve en el panel, Descubrimiento después del primer login, El mecanismo real de bloqueo: contadores nativos de SENSA, Límite real de los contadores de SENSA (confirmado 21/08/2026) (+30 more)

### Community 37 - "api"
Cohesion: 0.16
Nodes (33): ResellerStatusBadge(), TeamMemberStatusBadge(), AppLayout(), NotFound(), RequiereSesion(), SoloOperador(), SoloRevendedora(), AccountDetail() (+25 more)

### Community 38 - "Integración con SENSA"
Cohesion: 0.06
Nodes (32): Aislamiento multi-tenant, Cómo se activa el contexto, Dos capas de defensa, Qué ve el Operador Principal (tabla normativa), Ver también, Verificación, Casos especiales, Cola de reintentos (BullMQ) (+24 more)

### Community 39 - "compilerOptions"
Cohesion: 0.07
Nodes (29): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+21 more)

### Community 40 - "clientes.service.ts"
Cohesion: 0.29
Nodes (5): CODIGOS_DNI_REPETIDO, CODIGOS_EMAIL_REPETIDO, CODIGOS_TRANSITORIOS, CODIGOS_VALIDACION, SensaEnvelope

### Community 41 - "common.tsx"
Cohesion: 0.13
Nodes (27): CustomerStatusBadge(), DetailRow(), DeviceStatusBadge(), DeviceTypeBadge(), SecretValue(), tonoPorEstado, VinculacionEnCursoAlert(), AddDeviceDialog() (+19 more)

### Community 42 - "Dashboard.tsx"
Cohesion: 0.12
Nodes (14): ResolverIncidenciaDto, ApiProperty, ApiPropertyOptional, IsIn, IsOptional, IsUUID, IncidenciasDispositivosController, ApiOperation (+6 more)

### Community 43 - "DispositivosController"
Cohesion: 0.15
Nodes (12): DispositivosController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+4 more)

### Community 44 - "ListarAuditoriaQueryDto"
Cohesion: 0.10
Nodes (19): AuditoriaController, ApiOperation, ApiTags, Controller, Get, Query, Res, AuditoriaModule (+11 more)

### Community 45 - "CustomerDetail.tsx"
Cohesion: 0.11
Nodes (23): ALTURAS_BARRA, CapacityMeter(), OcupacionCuenta, ItemMenu, ITEMS, MenuUsuario(), NavItems(), ConfirmDialog() (+15 more)

### Community 46 - "CommercialPlanList.tsx"
Cohesion: 0.36
Nodes (17): AccountStatusBadge(), CopyableId(), ExportCsvButton(), Select(), Card(), EmptyState(), Input, Paginacion() (+9 more)

### Community 47 - "CustomerDetail.tsx"
Cohesion: 0.18
Nodes (23): HealthBadge(), Metric(), PageHeader(), Alert(), Badge(), BadgeProps, badgeVariants, BotonProps (+15 more)

### Community 48 - "SoloRevendedor"
Cohesion: 0.19
Nodes (12): SoloRevendedor(), ClientesController, ApiOperation, ApiQuery, ApiTags, Body, Controller, Get (+4 more)

### Community 49 - "types.ts"
Cohesion: 0.07
Nodes (31): ProviderDeviceClassBadge(), CardFooter(), Textarea, EstadoFormulario, INICIAL, MetodoAlta, PASOS, customerIntakeHelp (+23 more)

### Community 50 - "app.module.ts"
Cohesion: 0.07
Nodes (32): AuditModule, Global, Module, AppConfig, configuration(), toInt(), validateConfig(), ContextModule (+24 more)

### Community 51 - ".transaction"
Cohesion: 0.14
Nodes (16): AppModule, Module, crearProteccionSwagger(), iguales(), logger, OpcionesSwagger, bootstrap(), CuentasController (+8 more)

### Community 52 - "Decisiones pendientes"
Cohesion: 0.11
Nodes (17): 1 · Comercial, 2 · Autenticación y provisioning (Auth0), 3 · Seguridad de datos sensibles, 4 · Integración SENSA — casos límite, 5 · Parametrización — umbrales y validaciones, 6 · Menú de Parametrización, 7 · Documentación, Decisiones pendientes (+9 more)

### Community 53 - "CrearClienteDto"
Cohesion: 0.15
Nodes (16): ArrayUnique, CrearClienteDto, DispositivoAltaDto, ApiProperty, ApiPropertyOptional, IsBoolean, IsEmail, IsEnum (+8 more)

### Community 54 - "dispositivos.controller.ts"
Cohesion: 0.36
Nodes (11): ActualizarDispositivoDto, CrearDispositivoDto, ListarDispositivosQueryDto, ReasignarDispositivoDto, ApiProperty, ApiPropertyOptional, IsEnum, IsOptional (+3 more)

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
Cohesion: 0.24
Nodes (7): ApiExcludeEndpoint, Public(), HealthController, ApiOperation, ApiTags, Controller, Get

### Community 61 - "devDependencies"
Cohesion: 0.15
Nodes (13): autoprefixer, @eslint/js, devDependencies, autoprefixer, eslint, @eslint/js, tailwindcss, @types/react-dom (+5 more)

### Community 62 - "sensa.adapter.spec.ts"
Cohesion: 0.29
Nodes (6): CorregirVinculacionDto, ApiProperty, ApiPropertyOptional, IsIn, IsOptional, IsUUID

### Community 63 - "cuentas.mapper.ts"
Cohesion: 0.10
Nodes (20): CoincidenciaGestionExterna, armarCategoria(), calcularCapacidad(), CapacidadCategoria, CapacidadCuenta, contarDispositivosCliente(), contarOcupados(), contarVentasActivas() (+12 more)

### Community 64 - "CrearTeamMemberDto"
Cohesion: 0.12
Nodes (17): PaginatedResponse, armarOcupacion(), CuentaOperadorDto, CuentaRevendedoraDto, mapCuentaParaOperador(), mapCuentaParaRevendedora(), mapDispositivoParaOperador(), mapDispositivoParaRevendedora() (+9 more)

### Community 65 - "Registro de auditoría"
Cohesion: 0.15
Nodes (11): Lo que no incluye el MVP, Quién consulta qué, Qué se registra, Registro de auditoría, Regla de oro para escribir en el log, Ver también, Exportación a CSV, La pregunta que responde (+3 more)

### Community 66 - "TeamMembersController"
Cohesion: 0.19
Nodes (9): ReportesController, ApiOperation, ApiQuery, ApiTags, Controller, Get, Query, Res (+1 more)

### Community 68 - "clientes.controller.ts"
Cohesion: 0.17
Nodes (6): ReportesService, Injectable, ResultadoPrueba, ProveedorService, Injectable, Inject

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

### Community 82 - "utils.ts"
Cohesion: 0.20
Nodes (13): AuditLogEntry(), DetalleItem(), formatearValor(), humanizar(), IntegrationHealthPanel(), ProviderSettings(), ReportsView(), auditEntityLabels (+5 more)

### Community 84 - "Auth0ManagementService"
Cohesion: 0.33
Nodes (9): OpcionesLlamada, SensaAddUserRequest, SensaCreateDeviceRequest, SensaDevice, SensaDeviceEnvelopeResponse, SensaEditUserRequest, SensaLicensesResponse, SensaUser (+1 more)

### Community 87 - "@nestjs/bullmq"
Cohesion: 0.60
Nodes (5): "cuenta", "dispositivo", "incidencia_dispositivo_proveedor", "reserva_tecnica_dispositivo", "solicitud_vinculacion_dispositivo"

### Community 117 - "generarCsv"
Cohesion: 0.24
Nodes (9): ColumnaCsv, CsvCliente, ActualizarClienteDto, ListarClientesQueryDto, ApiPropertyOptional, IsEnum, IsOptional, IsString (+1 more)

## Knowledge Gaps
- **494 isolated node(s):** `docker-entrypoint.sh script`, `$schema`, `collection`, `sourceRoot`, `deleteOutDir` (+489 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `RequestContextService` to `ColaProveedorService`, `CrearTeamMemberDto`, `revendedoras.service.ts`, `CrearModalidadDto`, `clientes.controller.ts`, `CryptoService`, `ListarAuditoriaQueryDto`, `app.module.ts`, `HealthController`, `cuentas.mapper.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `RequestContextService` connect `RequestContextService` to `CrearTeamMemberDto`, `CrearModalidadDto`, `revendedoras.service.ts`, `clientes.controller.ts`, `CryptoService`, `ListarAuditoriaQueryDto`, `SoloRevendedor`, `generarCsv`, `.consumo`, `HttpExceptionFilter`, `cuentas.mapper.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `CrearTeamMemberDto` connect `Auth0ManagementService` to `CrearTeamMemberDto`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `docker-entrypoint.sh script`, `$schema`, `collection` to the rest of the system?**
  _494 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `RequestContextService` be split into smaller, more focused modules?**
  _Cohesion score 0.0847457627118644 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._