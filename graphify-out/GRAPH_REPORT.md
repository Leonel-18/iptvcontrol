# Graph Report - iptvcontrol-opencode  (2026-10-13)

## Corpus Check
- 333 files · ~214,400 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2541 nodes · 6091 edges · 189 communities (153 shown, 36 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c60d9665`
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
- RevendedorasController
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
- calendario-comercial.ts
- CustomerDetail.tsx
- SoloRevendedor
- types.ts
- app.module.ts
- .transaction
- Decisiones pendientes
- CrearClienteDto
- dispositivos.controller.ts
- RevendedorasService
- Despliegue y operación
- jest
- LandingPage.tsx
- Flujo — Alta de Cliente Final
- HealthController
- devDependencies
- sensa.adapter.spec.ts
- cuentas.mapper.ts
- configuracion.module.ts
- Registro de auditoría
- TeamMembersController
- migration.sql
- clientes.controller.ts
- 7. Demo paso a paso (lo que mostrás, decís, remarcás, evitás)
- configuracion-plantilla.controller.ts
- app.json
- IPTVControl
- HU-A02 — Aislar cuenta compartida existente
- HU-A03 — Vencimiento y revocación de aislamiento
- IPTVControl — Índice del vault
- seed-root.ts
- @nestjs/platform-express
- Vault de Obsidian — IPTVControl
- AuditModule
- ContextModule
- team-members.service.ts
- TeamMembersController
- vite-env.d.ts
- Auth0ManagementService
- HU-P03 — Crear cuenta de prueba
- HU-P04 — Tags de cuenta de prueba
- @nestjs/bullmq
- HU-P06 — Vencimiento automático de cuenta de prueba
- HU-P07 — Auditoría del ciclo de cuentas de prueba
- HU-N01 — Centro de notificaciones persistentes
- HU-N02 — Configuración de notificaciones
- HU-N03 — Avisos de cuentas de prueba por vencer
- HU-N04 — Avisos de ventana de alta por vencer
- HU-N05 — Preferencias de usuario y sonido
- ClientesService
- TeamMembersService
- HU-D02 — Autoasignar dispositivo con un único cliente activo
- HU-D03 — Notificar dispositivo con cero o varios clientes activos
- HU-D04 — Recordatorios de dispositivos pendientes
- IPTVControl — Decisiones Pendientes (consolidado)
- MACHETE — Demo cliente IPTVControl
- .crear
- IPTVControl — Instrucciones del Proyecto
- app.json
- crearProteccionSwagger
- FAQ — IPTVControl para Empresa Revendedora
- CrearTeamMemberDto
- verificar-rls.sql
- compilerOptions
- ColaProveedorService
- Orden recomendado de implementación
- session.tsx
- integracion-whatsapp.module.ts
- ProveedorTelemetryService
- ListarCuentasQueryDto
- ProveedorRateLimiterService
- migration.sql
- migration.sql
- ActualizarCuentaDto
- ConvertirPruebaAPermanenteDto
- JwtAuthGuard
- migration.sql
- migration.sql
- CorregirVinculacionDto
- whatsapp-bot.controller.ts
- Vault de Obsidian — IPTVControl
- 12. Cuentas
- 14. Límites (sección central)
- 15. Estados
- ModalidadesService
- metadatosDispositivoProveedor
- migration.sql
- migration.sql
- HttpExceptionFilter
- CuentaProveedor
- ServiciosCuenta
- .llamar
- PrismaModule
- migration.sql
- PrismaModule
- health.module.ts
- migration.sql
- CambiarPasswordCuentaDto
- migration.sql
- migration.sql
- Ventana de curiosidad (Fase 2)
- Entidades
- Ciclo de vida del Cliente Final
- Modalidades comerciales
- 5. Preparación antes de la llamada
- Ciclo de vida del Cliente Final.md
- Team Members
- Validación de ID de gestión externa
- migration.sql
- migration.sql
- migration.sql
- migration.sql
- migration.sql
- migration.sql
- migration.sql
- docker-entrypoint.sh
- "reserva_tecnica_dispositivo"
- "cliente_final"
- "cuenta"
- "plantilla_whatsapp"
- "solicitud_vinculacion_dispositivo"
- "cuenta"
- 01-app-user.sh
- 25. Checklist final (revisión contra el código)
- QueuesModule
- migration.sql

## God Nodes (most connected - your core abstractions)
1. `api()` - 85 edges
2. `PrismaService` - 78 edges
3. `RequestContextService` - 75 edges
4. `ProveedorService` - 52 edges
5. `cn()` - 52 edges
6. `AuditService` - 41 edges
7. `SoloRevendedor()` - 40 edges
8. `useSesion()` - 39 edges
9. `Button` - 37 edges
10. `SensaAdapter` - 35 edges

## Surprising Connections (you probably didn't know these)
- `MenuUsuario()` --calls--> `useSesion()`  [EXTRACTED]
  frontend/src/components/layout/AppLayout.tsx → frontend/src/lib/session.tsx
- `ConnectionSection()` --calls--> `api()`  [EXTRACTED]
  frontend/src/features/settings/SettingsView.tsx → frontend/src/lib/api.ts
- `bootstrap()` --indirect_call--> `AppModule`  [INFERRED]
  backend/src/main.ts → backend/src/app.module.ts
- `ConfiguracionNotificacionesController` --references--> `SoloRevendedor()`  [EXTRACTED]
  backend/src/modules/configuracion/configuracion-notificaciones.controller.ts → backend/src/common/auth/decorators.ts
- `ConfiguracionPlantillaController` --references--> `SoloRevendedor()`  [EXTRACTED]
  backend/src/modules/configuracion/configuracion-plantilla.controller.ts → backend/src/common/auth/decorators.ts

## Import Cycles
- None detected.

## Communities (189 total, 36 thin omitted)

### Community 0 - "RequestContextService"
Cohesion: 0.16
Nodes (14): DispositivosController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+6 more)

### Community 2 - "sensa.adapter.ts"
Cohesion: 0.19
Nodes (15): OpcionesLlamada, CODIGOS_DNI_REPETIDO, CODIGOS_EMAIL_REPETIDO, CODIGOS_TRANSITORIOS, CODIGOS_VALIDACION, SENSA_CODIGOS, SensaAddUserRequest, SensaCreateDeviceRequest (+7 more)

### Community 3 - "devDependencies"
Cohesion: 0.14
Nodes (3): RequestContext, PrismaService, Injectable

### Community 4 - "dependencies"
Cohesion: 0.05
Nodes (38): Alerta de "cerca del tope", Baja y suspensión, Capacidad de una Cuenta, Cómo se decide dónde entra un alta, Cómo se ve en el panel, Descubrimiento después del primer login, El mecanismo real de bloqueo: contadores nativos de SENSA, Límite real de los contadores de SENSA (confirmado 21/08/2026) (+30 more)

### Community 5 - "scripts"
Cohesion: 0.18
Nodes (15): agrupacionParaRango(), COLOR_SERIE, desdeParaRango(), ETIQUETA_SERIE, etiquetaEje(), etiquetaPunto(), formatearCompacto(), PAD (+7 more)

### Community 6 - "compilerOptions"
Cohesion: 0.07
Nodes (30): dist, node_modules, src/*, test/**/*, compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration (+22 more)

### Community 7 - "IPTVControl — Esqueleto Técnico Inicial"
Cohesion: 0.07
Nodes (26): 1. Entidades principales (borrador de modelo de datos), 2.1. Stack técnico confirmado, 2.2. Relaciones entre entidades, 2. Relaciones clave, 3.1. Identificadores requeridos por SENSA, 3. Integración con el Proveedor (SENSA) — patrón de conector desacoplado, 4.1. Alta de Cliente Final — dos métodos, 4.2. Baja definitiva de Cliente Final (+18 more)

### Community 8 - "IPTVControl — Reglas de Negocio"
Cohesion: 0.06
Nodes (30): 10. Sobre el documento de tareas de Federico, 11. Registro de auditoría (Audit Log), 12. Alerta de Cuenta cerca del tope de capacidad, 13. Exportación de datos propios a CSV, 14. Datos registrados de la Empresa Revendedora, 15.1. Aislar Cuenta (venta compartida dedicada), 15.2. Apertura manual de una Ventana de Alta, 15.3. Aislamiento de una Cuenta compartida existente (+22 more)

### Community 10 - "CryptoService"
Cohesion: 0.11
Nodes (15): AuditService, RegistroAuditoria, Injectable, SinCapacidadEnCuentaError, ClasificacionDispositivoProveedor, DispositivoInventarioDto, InventarioProveedorDto, AbrirVentanaParams (+7 more)

### Community 11 - "PaginationQueryDto"
Cohesion: 0.24
Nodes (13): CapacidadCuenta, armarOcupacion(), CuentaOperadorDto, CuentaRevendedoraDto, esAislamientoVigente(), mapCuentaParaOperador(), mapCuentaParaRevendedora(), mapDispositivoParaOperador() (+5 more)

### Community 12 - "ProveedorAdapter"
Cohesion: 0.17
Nodes (10): ProveedoresController, ApiOperation, ApiTags, Controller, Get, Param, Post, SoloOperador (+2 more)

### Community 13 - "Entidades (modelo de datos)"
Cohesion: 0.08
Nodes (19): ActualizarSonidoNotificacionesDto, ApiProperty, IsBoolean, NotificacionesController, ApiOperation, ApiTags, Controller, Get (+11 more)

### Community 14 - "IPTVControl — URL Structure / Routing Convention"
Cohesion: 0.06
Nodes (32): Aislamiento multi-tenant, Cómo se activa el contexto, Dos capas de defensa, Qué ve el Operador Principal (tabla normativa), Ver también, Verificación, Casos especiales, Cola de reintentos (BullMQ) (+24 more)

### Community 15 - "migration.sql"
Cohesion: 0.12
Nodes (15): 10. Checklist del integrador, 11. Postman, 1. Objetivo, 2. Datos que recibe el integrador, 3. Endpoint, 4. Duplicados y reintentos, 5. Campos del request, 6. Modalidades (+7 more)

### Community 16 - "migration.sql"
Cohesion: 0.16
Nodes (4): metadatosDispositivoProveedor(), parsearUltimoInicioProveedor(), ColaProveedorProcessor, Processor

### Community 17 - "decorators.ts"
Cohesion: 0.16
Nodes (6): ActualizarServiciosParams, CredencialesProveedor, CuentaInventarioProveedor, SensaAdapter, Injectable, SensaEnvelope

### Community 18 - "IPTVControl"
Cohesion: 0.13
Nodes (24): ActualizarRevendedoraDto, CambiarModalidadDto, CrearRevendedoraDto, ListarRevendedorasQueryDto, MetricasRevendedoraQueryDto, ApiProperty, ApiPropertyOptional, ArrayUnique (+16 more)

### Community 20 - "exclude"
Cohesion: 0.20
Nodes (9): dist, node_modules, test, exclude, extends, prisma/importar-micom.ts, prisma/seed-root.ts, **/*spec.ts (+1 more)

### Community 21 - "IPTVControl — Instrucciones del Proyecto"
Cohesion: 0.19
Nodes (10): CurrentUser, Roles(), SoloOperador(), ColumnaCsv, generarCsv(), responderCsv(), Fila, CsvCliente (+2 more)

### Community 22 - "instructions"
Cohesion: 0.22
Nodes (8): instructions, $schema, docs/01_Instrucciones_del_Proyecto.md, docs/02_Glosario_de_Actores_y_Entidades.md, docs/03_Reglas_de_Negocio.md, docs/04_Esqueleto_Tecnico_Inicial.md, docs/05_Decisiones_Pendientes.md, docs/IPTVControl_URL_Routing_Convention.md

### Community 23 - "nest-cli.json"
Cohesion: 0.29
Nodes (7): ListarCuentasQueryDto, ApiPropertyOptional, IsBoolean, IsEnum, IsOptional, IsUUID, Transform

### Community 24 - "Instructivo — Cargar IPTVControl en OpenCode"
Cohesion: 0.15
Nodes (9): DashboardController, ApiOperation, ApiTags, Controller, Get, Post, SoloOperador, DashboardService (+1 more)

### Community 25 - "configuration.ts"
Cohesion: 0.09
Nodes (21): 1. ¿Qué es IPTVControl y en qué estado está?, 2. Stack y topología actuales (Docker Compose local), 3. Variables de entorno, 4.1. Primer despliegue en una VPS nueva, 4.2. Actualización de código, 4.3. Cambio de datos de conexión SENSA / planes / modalidades, 4.4. Integración del bot de WhatsApp (alta de Clientes Finales por API), 4. Procedimientos de arranque / mantenimiento (+13 more)

### Community 26 - "csv.util.ts"
Cohesion: 0.32
Nodes (10): AgrupacionMetricas, finDiaDesdeTexto(), inicioDiaArgentina(), inicioDiaDesdeTexto(), inicioMesDesdeInstante(), inicioSemanaArgentina(), instanteArgentina(), mesSiguiente() (+2 more)

### Community 27 - "docker-entrypoint.sh"
Cohesion: 0.10
Nodes (18): 1 · Comercial, 2 · Autenticación y provisioning (Auth0), 3 · Seguridad de datos sensibles, 4 · Integración SENSA — casos límite, 5 · Parametrización — umbrales y validaciones, 6 · Menú de Parametrización, 7 · Documentación, Decisiones pendientes (+10 more)

### Community 28 - "01-app-user.sh"
Cohesion: 0.23
Nodes (11): RevendedorasController, ApiOperation, ApiTags, Body, Controller, Get, Param, Patch (+3 more)

### Community 30 - "ActualizarConexionProveedorDto"
Cohesion: 0.27
Nodes (15): ActualizarConexionProveedorDto, ActualizarNotificacionesDto, ActualizarVentanaCuriosidadDto, ProbarConexionDto, ApiPropertyOptional, ArrayUnique, IsArray, IsBoolean (+7 more)

### Community 31 - "primitives.tsx"
Cohesion: 0.36
Nodes (7): cifrar(), CODIGO_POR_NOMBRE, FilaCsv, invertirDni(), main(), mapearServicios(), prisma

### Community 32 - "ColaProveedorService"
Cohesion: 0.19
Nodes (11): CrearNotificacionParams, DatosCerrarCuenta, DatosEliminarDispositivo, DatosReconciliarDispositivos, DatosSincronizarContadoresVenta, DatosSondearVinculacion, OPCIONES_REINTENTO, TRABAJOS_PROVEEDOR (+3 more)

### Community 33 - "CrearModalidadDto"
Cohesion: 0.08
Nodes (31): ActualizarModalidadDto, CrearModalidadDto, ListarModalidadesQueryDto, ApiProperty, ApiPropertyOptional, IsDateString, IsEnum, IsInt (+23 more)

### Community 34 - "RevendedorasController"
Cohesion: 0.20
Nodes (24): Alert(), Badge(), badgeVariants, BotonProps, botonVariants, Button, Card(), CardContent() (+16 more)

### Community 35 - "dependencies"
Cohesion: 0.11
Nodes (19): CrearClienteBotDto, DispositivoBotDto, ApiProperty, ApiPropertyOptional, IsBoolean, IsEmail, IsEnum, IsIn (+11 more)

### Community 36 - "Capacidad de una Cuenta"
Cohesion: 0.11
Nodes (18): 10. Demo de 60 minutos (completa), 11. Funcionalidades principales (qué existe, verificado), 13. Clientes, 16. Errores (qué significan, cómo explicarlos), 17. Preguntas frecuentes (FAQ de la llamada), 18. Preguntas difíciles/incómodas (clasificadas), 1. Objetivo, 20. Errores comunes en los primeros días (+10 more)

### Community 37 - "api"
Cohesion: 0.11
Nodes (45): AppLayout(), NotFound(), RequiereSesion(), SoloOperador(), SoloRevendedora(), AccountDetail(), AccountList(), AuditLogList() (+37 more)

### Community 38 - "Integración con SENSA"
Cohesion: 0.12
Nodes (16): Acerca de, Aislamiento multi-tenant: cómo está garantizado, Arquitectura de la integración con el proveedor, Comandos habituales, Configurar Auth0 (paso previo al primer login), Convenciones de código (léelo antes de tocar algo), Desarrollo sin Docker, Documentación (+8 more)

### Community 39 - "compilerOptions"
Cohesion: 0.07
Nodes (29): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+21 more)

### Community 40 - "clientes.service.ts"
Cohesion: 0.12
Nodes (15): Arranque en frío y seed, El problema del huevo y la gallina, El seed, Invitación del resto del equipo, Salvaguarda del último administrador, Ver también, Backups, Despliegue y operación (+7 more)

### Community 41 - "common.tsx"
Cohesion: 0.09
Nodes (39): AccountStatusBadge(), CustomerStatusBadge(), DetailRow(), DeviceStatusBadge(), DeviceTypeBadge(), ProviderDeviceClassBadge(), ResellerStatusBadge(), SecretValue() (+31 more)

### Community 42 - "Dashboard.tsx"
Cohesion: 0.11
Nodes (16): ResolverIncidenciaDto, ApiProperty, ApiPropertyOptional, IsIn, IsOptional, IsUUID, IncidenciasDispositivosController, ApiOperation (+8 more)

### Community 43 - "DispositivosController"
Cohesion: 0.10
Nodes (8): ActualizarCapacidadParams, ActualizarPasswordParams, ActualizarPinParams, CrearCuentaParams, CuentaProveedor, PROVEEDOR_ADAPTERS, ResultadoPrueba, ServiciosCuenta

### Community 44 - "ListarAuditoriaQueryDto"
Cohesion: 0.10
Nodes (18): AuditoriaController, ApiOperation, ApiTags, Controller, Get, Query, Res, AuditoriaModule (+10 more)

### Community 45 - "CustomerDetail.tsx"
Cohesion: 0.10
Nodes (25): DialogContent(), Field(), getUnlinkedProviderDevices(), puedeAgregarCliente(), AccountDevicesTab(), ClienteDeLaCuenta, CorrectDeviceBindingDialog(), EditAccountDialog() (+17 more)

### Community 46 - "calendario-comercial.ts"
Cohesion: 0.08
Nodes (31): PaginationQueryDto, ApiPropertyOptional, IsIn, IsInt, IsOptional, IsString, Max, Min (+23 more)

### Community 47 - "CustomerDetail.tsx"
Cohesion: 0.23
Nodes (26): CopyableId(), ExportCsvButton(), PageHeader(), ConfirmDialog(), Select(), EmptyState(), Input, Paginacion() (+18 more)

### Community 48 - "SoloRevendedor"
Cohesion: 0.21
Nodes (11): ClientesController, ApiOperation, ApiQuery, ApiTags, Body, Controller, Get, Param (+3 more)

### Community 49 - "types.ts"
Cohesion: 0.29
Nodes (9): armarCategoria(), calcularCapacidad(), CapacidadCategoria, contarDispositivosCliente(), contarOcupados(), contarVentasActivas(), CuentaCapacidadInput, DispositivoCapacidadInput (+1 more)

### Community 50 - "app.module.ts"
Cohesion: 0.17
Nodes (18): ClientesModule, Module, CuentasModule, Module, DashboardModule, Module, DispositivosModule, Module (+10 more)

### Community 51 - ".transaction"
Cohesion: 0.22
Nodes (12): SoloRevendedor(), CuentasController, ApiOperation, ApiTags, Body, Controller, Get, Param (+4 more)

### Community 52 - "Decisiones pendientes"
Cohesion: 0.14
Nodes (13): Actores (roles de negocio), Cliente Final, Cuenta (Cuenta SENSA), Dispositivo, Empresa Revendedora, Entidades (modelo de datos), IPTVControl — Glosario de Actores y Entidades, Modalidad Comercial (+5 more)

### Community 53 - "CrearClienteDto"
Cohesion: 0.11
Nodes (21): CrearClienteDto, DispositivoAltaDto, ApiProperty, ApiPropertyOptional, ArrayUnique, IsArray, IsBoolean, IsEmail (+13 more)

### Community 54 - "dispositivos.controller.ts"
Cohesion: 0.14
Nodes (13): 1. Principios aplicados, 2. Tabla de rutas, 3. Ejemplos de rutas anidadas resueltas por query param (no por segmento), 4.1. Convención de nombres de componentes, 4.2. Dónde vive el mapeo español↔inglés en el código, 4.3. `/users` → `/team-members`: por qué el cambio de nombre, 4.4. Excepción a la ruta `/team-members`: el primer Team Member root, 4. Decisión confirmada por Bruno: inglés en URLs y en componentes de UI (+5 more)

### Community 55 - "RevendedorasService"
Cohesion: 0.28
Nodes (9): ActualizarClienteDto, ListarClientesQueryDto, ApiPropertyOptional, IsEnum, IsOptional, IsString, IsUUID, Matches (+1 more)

### Community 56 - "Despliegue y operación"
Cohesion: 0.14
Nodes (12): Carga manual en una Cuenta compartida vacía, Descubrimiento del Dispositivo, El identificador tipo DNI, Flujo — Alta de Cliente Final, Los cuatro pasos del asistente, Los dos métodos de alta, Si el Proveedor falla, Ver también (+4 more)

### Community 57 - "jest"
Cohesion: 0.39
Nodes (4): LicenciasProveedor, normalizarServicios(), serviciosContratados(), validarServiciosContratados()

### Community 58 - "LandingPage.tsx"
Cohesion: 0.15
Nodes (11): ThemeToggle(), Cargando(), capabilities, LandingPage(), steps, ThemeToggle(), ContextoTema, ProveedorDeTema() (+3 more)

### Community 59 - "Flujo — Alta de Cliente Final"
Cohesion: 0.19
Nodes (9): ConfiguracionController, ApiOperation, ApiTags, Body, Controller, Get, Patch, Post (+1 more)

### Community 60 - "HealthController"
Cohesion: 0.22
Nodes (7): ApiExcludeEndpoint, Public(), HealthController, ApiOperation, ApiTags, Controller, Get

### Community 61 - "devDependencies"
Cohesion: 0.15
Nodes (9): "audit_log", "cliente_final", "configuracion_proveedor", "cuenta", "dispositivo", "empresa_revendedora", "llamada_proveedor", "modalidad_comercial" (+1 more)

### Community 62 - "sensa.adapter.spec.ts"
Cohesion: 0.15
Nodes (11): Lo que no incluye el MVP, Quién consulta qué, Qué se registra, Registro de auditoría, Regla de oro para escribir en el log, Ver también, Exportación a CSV, La pregunta que responde (+3 more)

### Community 63 - "cuentas.mapper.ts"
Cohesion: 0.14
Nodes (9): bordeMesArgentina(), diferenciaZonaArgentina(), finMesArgentina(), inicioMesArgentina(), partesMesArgentina(), periodoMesArgentina(), EMPRESA_BASE, RevendedorasService (+1 more)

### Community 64 - "configuracion.module.ts"
Cohesion: 0.22
Nodes (7): ConfiguracionNotificacionesController, ApiOperation, ApiTags, Body, Controller, Get, Patch

### Community 66 - "TeamMembersController"
Cohesion: 0.17
Nodes (11): ReportesController, ApiOperation, ApiQuery, ApiTags, Controller, Get, Query, Res (+3 more)

### Community 67 - "migration.sql"
Cohesion: 0.44
Nodes (11): "audit_log", "cliente_final", "configuracion_proveedor", "cuenta", "dispositivo", "empresa_revendedora", "llamada_proveedor", "modalidad_comercial" (+3 more)

### Community 69 - "7. Demo paso a paso (lo que mostrás, decís, remarcás, evitás)"
Cohesion: 0.17
Nodes (12): 7.10 Errores y mensajes, 7.11 Cierre, 7.1 Login, 7.2 Dashboard, 7.3 Estructura — ir a Cuentas y abrir una compartida, 7.4 Concepto 1+1 / 2+2 y "pendientes", 7.5 Alta de cliente (wizard), 7.6 Resultado en la Cuenta (+4 more)

### Community 70 - "configuracion-plantilla.controller.ts"
Cohesion: 0.22
Nodes (7): ConfiguracionPlantillaController, ApiOperation, ApiTags, Body, Controller, Get, Patch

### Community 72 - "IPTVControl"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 73 - "HU-A02 — Aislar cuenta compartida existente"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 74 - "HU-A03 — Vencimiento y revocación de aislamiento"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 75 - "IPTVControl — Índice del vault"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 76 - "seed-root.ts"
Cohesion: 0.60
Nodes (4): cifrar(), crearUsuarioAuth0(), main(), prisma

### Community 77 - "@nestjs/platform-express"
Cohesion: 0.09
Nodes (14): CryptoService, Injectable, EMPRESA, CrearCuentaOpciones, CuentasProvisioningService, LimiteCreacionMensualError, SincronizacionContadoresPendienteError, Injectable (+6 more)

### Community 78 - "Vault de Obsidian — IPTVControl"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 79 - "AuditModule"
Cohesion: 0.06
Nodes (54): CuriosityDurationInput(), DurationParts, maxEfectivo(), normalizeMinutes(), CardFooter(), Textarea, AddManualCustomerDialog(), actorLabel() (+46 more)

### Community 80 - "ContextModule"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 81 - "team-members.service.ts"
Cohesion: 0.15
Nodes (12): ArrayMaxSize, ArrayMinSize, ImportarCuentasExternasDto, ApiProperty, ApiPropertyOptional, ArrayUnique, IsArray, IsBoolean (+4 more)

### Community 82 - "TeamMembersController"
Cohesion: 0.07
Nodes (24): Auth0ManagementService, Injectable, CrearTeamMemberDto, ListarTeamMembersQueryDto, ApiProperty, ApiPropertyOptional, IsEmail, IsEnum (+16 more)

### Community 84 - "Auth0ManagementService"
Cohesion: 0.20
Nodes (7): AuthModule, Module, JwtPayload, JwtStrategy, Injectable, TeamMembersModule, Module

### Community 85 - "HU-P03 — Crear cuenta de prueba"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 86 - "HU-P04 — Tags de cuenta de prueba"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 87 - "@nestjs/bullmq"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 88 - "HU-P06 — Vencimiento automático de cuenta de prueba"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 89 - "HU-P07 — Auditoría del ciclo de cuentas de prueba"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 90 - "HU-N01 — Centro de notificaciones persistentes"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 91 - "HU-N02 — Configuración de notificaciones"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 92 - "HU-N03 — Avisos de cuentas de prueba por vencer"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 93 - "HU-N04 — Avisos de ventana de alta por vencer"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 94 - "HU-N05 — Preferencias de usuario y sonido"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 95 - "ClientesService"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 96 - "TeamMembersService"
Cohesion: 0.25
Nodes (7): AbrirVentanaCuriosidadDto, ApiPropertyOptional, IsInt, IsOptional, Max, Min, Type

### Community 97 - "HU-D02 — Autoasignar dispositivo con un único cliente activo"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 98 - "HU-D03 — Notificar dispositivo con cero o varios clientes activos"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 99 - "HU-D04 — Recordatorios de dispositivos pendientes"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 100 - "IPTVControl — Decisiones Pendientes (consolidado)"
Cohesion: 0.20
Nodes (9): 1. Comercial / negocio, 2. Autenticación y provisioning (Auth0), 3. Seguridad de datos sensibles, 4. Integración SENSA — casos límite, 5. Parametrización — umbrales y validaciones, 6. Menú de Parametrización — conexión SENSA (`04_Esqueleto_Tecnico_Inicial.md`, sección 9), 7. Documentación / infraestructura de trabajo, 8. Fuente descartada — recordatorio (+1 more)

### Community 101 - "MACHETE — Demo cliente IPTVControl"
Cohesion: 0.20
Nodes (9): ANTES DE EMPEZAR, CIERRE, INTRO (2 min), MACHETE — Demo cliente IPTVControl, MOSTRAR (en orden), NO PROMETER (si te preguntan), PREGUNTAS PROBABLES, RECORDAR EXPLICAR (+1 more)

### Community 102 - ".crear"
Cohesion: 0.15
Nodes (11): ApiHeader, ApiOperation, ApiTags, Body, Controller, Post, WhatsappBotController, Injectable (+3 more)

### Community 103 - "IPTVControl — Instrucciones del Proyecto"
Cohesion: 0.22
Nodes (8): Alcance del MVP (primera etapa), Cómo quiero que Claude me responda en este Proyecto, Datos de la empresa (para cotizaciones, informes o material formal derivado de este proyecto), Documentos que forman parte de este Proyecto, Infraestructura y equipo de desarrollo, IPTVControl — Instrucciones del Proyecto, Qué es este proyecto, Stack tecnológico

### Community 104 - "app.json"
Cohesion: 0.22
Nodes (8): alwaysUpdateLinks, attachmentFolderPath, defaultViewMode, newLinkFormat, readableLineLength, showLineNumber, strictLineBreaks, useMarkdownLinks

### Community 105 - "crearProteccionSwagger"
Cohesion: 0.18
Nodes (9): AppModule, Module, crearProteccionSwagger(), iguales(), logger, OpcionesSwagger, RequestContextMiddleware, Injectable (+1 more)

### Community 106 - "FAQ — IPTVControl para Empresa Revendedora"
Cohesion: 0.22
Nodes (8): Acceso y seguridad, Clientes, Cuentas, Dispositivos y 1+1 / 2+2, FAQ — IPTVControl para Empresa Revendedora, Mensajes y errores, Otras funciones, Ventana de Alta

### Community 107 - "CrearTeamMemberDto"
Cohesion: 0.25
Nodes (5): PruebasController, ApiOperation, ApiTags, Controller, Get

### Community 108 - "verificar-rls.sql"
Cohesion: 0.17
Nodes (5): TransactionClient, IdentificadoresService, Injectable, PruebasService, Injectable

### Community 115 - "compilerOptions"
Cohesion: 0.25
Nodes (7): collection, compilerOptions, deleteOutDir, plugins, tsConfigPath, $schema, sourceRoot

### Community 116 - "ColaProveedorService"
Cohesion: 0.11
Nodes (12): InvitacionTeamMember, PaginatedResponse, ETIQUETAS_ACCION, CoincidenciaGestionExterna, ClienteCreadoConCuenta, CuentaDelCliente, ResultadoAltaBot, EstadoCuentasPrueba (+4 more)

### Community 117 - "Orden recomendado de implementación"
Cohesion: 0.25
Nodes (7): IPTVControl — Historias de usuario: Aislamiento, Cuentas de Prueba, Notificaciones y Dispositivos, Orden recomendado de implementación, Reglas transversales cerradas, Épica A — Aislamiento, Épica B — Cuentas de prueba, Épica C — Notificaciones, Épica D — Dispositivos

### Community 118 - "session.tsx"
Cohesion: 0.07
Nodes (43): ALTURAS_BARRA, CapacityMeter(), OcupacionCuenta, HealthBadge(), Metric(), ItemMenu, ITEMS, MenuUsuario() (+35 more)

### Community 119 - "integracion-whatsapp.module.ts"
Cohesion: 0.31
Nodes (3): IdentidadCuentasService, IdentidadFicticia, Injectable

### Community 120 - "ProveedorTelemetryService"
Cohesion: 0.21
Nodes (4): ProveedorTelemetryService, Injectable, ProveedorRateLimiterService, Injectable

### Community 121 - "ListarCuentasQueryDto"
Cohesion: 0.47
Nodes (4): renderizarPlantilla(), TOKENS_PLANTILLA_WHATSAPP, validarPlantilla(), ValoresPlantilla

### Community 122 - "ProveedorRateLimiterService"
Cohesion: 0.13
Nodes (16): DniRepetidoError, EmailRepetidoError, ProveedorAutenticacionError, ProveedorNoDisponibleError, ProveedorValidacionError, ReintentosDniAgotadosError, BotErrorFilter, Catch (+8 more)

### Community 123 - "migration.sql"
Cohesion: 0.29
Nodes (6): Ejecución, Fuentes de verdad, IPTVControl, Reglas obligatorias, Respuesta final, Uso de contexto

### Community 124 - "migration.sql"
Cohesion: 0.29
Nodes (7): 19. Decisiones de diseño (por qué se hizo así), DECISIÓN: Aislamiento por empresa, DECISIÓN: Contraseña compartida sin rotación, DECISIÓN: Errores importantes dentro del formulario, DECISIÓN: Los "pendientes" no se guardan como dispositivos, DECISIÓN: Todo el flujo contra un proveedor real sin modo prueba, DECISIÓN: Ventas 1+1/2+2 y Cuentas compartidas

### Community 125 - "ActualizarCuentaDto"
Cohesion: 0.35
Nodes (5): ActualizarPlantillaWhatsAppDto, ConfiguracionProveedorRespuestaDto, ApiProperty, IsString, Length

### Community 126 - "ConvertirPruebaAPermanenteDto"
Cohesion: 0.22
Nodes (7): ConfiguracionRevendedorController, ApiOperation, ApiTags, Body, Controller, Get, Patch

### Community 127 - "JwtAuthGuard"
Cohesion: 0.29
Nodes (3): BotRedisClient, BotRedisService, Injectable

### Community 128 - "migration.sql"
Cohesion: 0.60
Nodes (5): "cuenta", "dispositivo", "incidencia_dispositivo_proveedor", "reserva_tecnica_dispositivo", "solicitud_vinculacion_dispositivo"

### Community 129 - "migration.sql"
Cohesion: 0.33
Nodes (5): Convenciones de este vault, IPTVControl — Índice del vault, Las cinco reglas que más se consultan, Mapa del sistema, Por dónde empezar

### Community 131 - "whatsapp-bot.controller.ts"
Cohesion: 0.16
Nodes (11): ConfiguracionModule, Module, BotApiKeyGuard, Injectable, BOT_REDIS_CLIENT, BotRateLimitExcedidoError, BotRateLimitService, Inject (+3 more)

### Community 132 - "Vault de Obsidian — IPTVControl"
Cohesion: 0.40
Nodes (4): Cómo abrirlo, Estructura, Relación con `docs/`, Vault de Obsidian — IPTVControl

### Community 133 - "12. Cuentas"
Cohesion: 0.40
Nodes (5): 12.1 Qué es una Cuenta **[CONFIRMADO]**, 12.2 Qué ve el usuario en la ficha de Cuenta, 12.3 Reglas que conviene explicar, 12.4 Pregunta típica, 12. Cuentas

### Community 134 - "14. Límites (sección central)"
Cohesion: 0.40
Nodes (5): 14.1 Cuáles existen, 14.2 Cómo se calcula cada número (explicación interna), 14.3 Ejemplos numéricos para la llamada, 14.4 Qué pasa si te acercás, 14. Límites (sección central)

### Community 135 - "15. Estados"
Cohesion: 0.40
Nodes (5): 15.1 De Cuenta, 15.2 De Cliente Final, 15.3 De Dispositivo (lo que ve el usuario), 15.4 Incidencias de dispositivos del proveedor, 15. Estados

### Community 136 - "ModalidadesService"
Cohesion: 0.50
Nodes (4): AppConfig, configuration(), toInt(), validateConfig()

### Community 137 - "metadatosDispositivoProveedor"
Cohesion: 0.36
Nodes (3): InventarioProveedorService, tipoProveedorANormalizado(), Injectable

### Community 138 - "migration.sql"
Cohesion: 0.50
Nodes (3): "cuenta", "dispositivo", "incidencia_dispositivo_proveedor"

### Community 140 - "HttpExceptionFilter"
Cohesion: 0.15
Nodes (6): TeamMemberGuard, Injectable, RequestContextService, Injectable, HttpExceptionFilter, Catch

### Community 141 - "CuentaProveedor"
Cohesion: 0.67
Nodes (3): AuditModule, Global, Module

### Community 142 - "ServiciosCuenta"
Cohesion: 0.67
Nodes (3): ContextModule, Global, Module

### Community 143 - ".llamar"
Cohesion: 0.67
Nodes (3): CryptoModule, Global, Module

### Community 144 - "PrismaModule"
Cohesion: 0.67
Nodes (3): PrismaModule, Global, Module

### Community 149 - "CambiarPasswordCuentaDto"
Cohesion: 0.07
Nodes (29): ActualizarCuentaDto, ApiPropertyOptional, ArrayUnique, IsArray, IsBoolean, IsOptional, IsString, AislarCuentaDto (+21 more)

### Community 152 - "Ventana de curiosidad (Fase 2)"
Cohesion: 0.29
Nodes (6): Alcance, Ciclo de vida, Historial, Puntos de enforcement en el backend, Ventana de curiosidad (Fase 2), Ver también

### Community 154 - "Ciclo de vida del Cliente Final"
Cohesion: 0.67
Nodes (3): 3.1 El concepto central es la CUENTA, 3.2 Quién ve qué, 3. Modelo mental del sistema

### Community 155 - "Modalidades comerciales"
Cohesion: 0.67
Nodes (3): 4.1 Actores reales **[CONFIRMADO en enums + guards]**, 4.2 Aislamiento (cómo se explica), 4. Roles y permisos

### Community 156 - "5. Preparación antes de la llamada"
Cohesion: 0.67
Nodes (3): 5.1 Checklist, 5.2 Datos de demostración sugeridos, 5. Preparación antes de la llamada

### Community 187 - "QueuesModule"
Cohesion: 0.67
Nodes (3): QueuesModule, Global, Module

## Knowledge Gaps
- **703 isolated node(s):** `docker-entrypoint.sh script`, `$schema`, `collection`, `sourceRoot`, `deleteOutDir` (+698 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `devDependencies` to `ColaProveedorService`, `whatsapp-bot.controller.ts`, `clientes.controller.ts`, `CryptoService`, `HttpExceptionFilter`, `verificar-rls.sql`, `@nestjs/platform-express`, `migration.sql`, `ColaProveedorService`, `csv.util.ts`, `HealthController`, `ActualizarCuentaDto`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `RequestContextService` connect `HttpExceptionFilter` to `ColaProveedorService`, `devDependencies`, `whatsapp-bot.controller.ts`, `csv.util.ts`, `crearProteccionSwagger`, `CryptoService`, `Auth0ManagementService`, `verificar-rls.sql`, `@nestjs/platform-express`, `ColaProveedorService`, `IPTVControl — Instrucciones del Proyecto`, `ProveedorRateLimiterService`, `ActualizarCuentaDto`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `SoloRevendedor()` connect `.transaction` to `configuracion.module.ts`, `RequestContextService`, `configuracion-plantilla.controller.ts`, `Dashboard.tsx`, `CrearTeamMemberDto`, `Entidades (modelo de datos)`, `calendario-comercial.ts`, `SoloRevendedor`, `IPTVControl — Instrucciones del Proyecto`, `CambiarPasswordCuentaDto`, `ActualizarCuentaDto`, `ConvertirPruebaAPermanenteDto`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `docker-entrypoint.sh script`, `$schema`, `collection` to the rest of the system?**
  _703 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SensaAdapter` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13970588235294118 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._