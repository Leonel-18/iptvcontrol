# Graph Report - iptvcontrol-opencode  (2026-10-27)

## Corpus Check
- 345 files · ~236,348 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 4, .example 2, .conf 2)

## Summary
- 2881 nodes · 7985 edges · 193 communities (130 shown, 63 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 428 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `de126c0c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- RequestContextService
- SensaAdapter
- sensa.adapter.ts
- PrismaService
- types.ts
- cn
- compilerOptions
- IPTVControl — Esqueleto Técnico Inicial
- IPTVControl — Reglas de Negocio
- IPTVControl — Guía de integración para el Portal de Cliente
- @prisma/client
- cuentas.service.ts
- CrearClienteBotDto
- NotificacionesController
- dependencies
- migration.sql
- migration.sql
- decorators.ts
- IPTVControl
- devDependencies
- tsconfig.build.json
- decorators.ts
- CuentasProvisioningService
- dependencies
- Instructivo — Cargar IPTVControl en OpenCode
- configuration.ts
- csv.util.ts
- compilerOptions
- 01-app-user.sh
- backend/package.json
- ConfiguracionService
- primitives.tsx
- ColaProveedorService
- CrearModalidadDto
- primitives.tsx
- devDependencies
- Capacidad de una Cuenta
- api.ts
- Registro de auditoría
- scripts
- common.tsx
- Dashboard.tsx
- DispositivosController
- ListarAuditoriaQueryDto
- api
- dispositivos.controller.ts
- CustomerDetail.tsx
- ClientesService
- portal-cliente.controller.ts
- @nestjs/common
- .transaction
- README.md
- CrearClienteDto
- 4. Flujos principales (a diagramar en Mermaid en la documentación Obsidian)
- Entidades (modelo de datos)
- PreferenciasController
- RevendedorasService
- LandingPage.tsx
- IPTVControl — URL Structure / Routing Convention
- PortalClienteService
- jest
- Decisiones pendientes
- calendario-comercial.ts
- IPTVControl — Instrucciones del Proyecto
- .registrarEnTx
- TeamMembersController
- scripts
- DispositivosService
- 7. Demo paso a paso (lo que mostrás, decís, remarcás, evitás)
- Capacidad de una Cuenta
- Integración con SENSA
- IPTVControl
- HU-A02 — Aislar cuenta compartida existente
- HU-A03 — Vencimiento y revocación de aislamiento
- IPTVControl — Índice del vault
- seed-root.ts
- CryptoService
- Vault de Obsidian — IPTVControl
- AccountDetail.tsx
- ContextModule
- team-members.service.ts
- TeamMembersController
- vite-env.d.ts
- jwt.strategy.ts
- HU-P03 — Crear cuenta de prueba
- HU-P04 — Tags de cuenta de prueba
- @nestjs/bullmq
- Despliegue y operación
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
- nest-cli.json
- MACHETE — Demo cliente IPTVControl
- WhatsappBotController
- .llamar
- IPTVControl — Decisiones Pendientes (consolidado)
- crearProteccionSwagger
- FAQ — IPTVControl para Empresa Revendedora
- CrearTeamMemberDto
- verificar-rls.sql
- frontend/package.json
- @testing-library/jest-dom
- vite.config.ts
- Flujo — Alta de Cliente Final
- revendedoras.service.ts
- Orden recomendado de implementación
- overlays.tsx
- integracion-whatsapp.module.ts
- ProveedorTelemetryService
- configuracion.service.ts
- ProveedorRateLimiterService
- IPTVControl
- migration.sql
- ActualizarCuentaDto
- ConvertirPruebaAPermanenteDto
- 2. Ciclo de vida de una Cuenta
- Entidades
- Riesgo aceptado — contraseña compartida sin rotación
- CorregirVinculacionDto
- whatsapp-bot.controller.ts
- 9. Menú de Parametrización — Conexión con SENSA
- 12. Cuentas
- 14. Límites (sección central)
- 15. Estados
- ModalidadesService
- Ciclo de vida del Cliente Final
- Aislamiento multi-tenant
- Consistencia con el Proveedor
- HttpExceptionFilter
- Patrón ProveedorAdapter
- Arranque en frío y seed
- RequestContextMiddleware
- IPTVControl — Índice del vault
- 20260814120000_init/migration.sql
- Team Members
- @nestjs/swagger
- Validación de ID de gestión externa
- Stack técnico
- Ventana de curiosidad (Fase 2)
- Vault de Obsidian — IPTVControl
- Ciclo de vida del Cliente Final
- Modalidades comerciales
- 5. Preparación antes de la llamada
- 15. Ventana de curiosidad (Fase 2)
- 1. Modalidades comerciales
- Flujo — Dispositivo adicional sin migración imposible
- AjustarSlotVentaDto
- opencode.json
- docker-entrypoint.sh
- 01-app-user.sh
- 25. Checklist final (revisión contra el código)

## God Nodes (most connected - your core abstractions)
1. `@nestjs/common` - 105 edges
2. `api()` - 90 edges
3. `Button` - 88 edges
4. `PrismaService` - 81 edges
5. `RequestContextService` - 79 edges
6. `Alert()` - 71 edges
7. `cn()` - 58 edges
8. `@prisma/client` - 55 edges
9. `ProveedorAdapter` - 55 edges
10. `Card()` - 55 edges

## Surprising Connections (you probably didn't know these)
- `Lo que el adapter traduce (y la lógica de negocio nunca ve)` --references--> `DniRepetidoError`  [INFERRED]
  vault/20 - Arquitectura/Patrón ProveedorAdapter.md → backend/src/common/errors/proveedor.errors.ts
- `Reglas obligatorias` --references--> `ProveedorAdapter`  [INFERRED]
  AGENTS.md → backend/src/proveedor/proveedor-adapter.interface.ts
- `10. Sobre el documento de tareas de Federico` --references--> `ProveedorAdapter`  [INFERRED]
  docs/03_Reglas_de_Negocio.md → backend/src/proveedor/proveedor-adapter.interface.ts
- `8. API pública para Empresas Revendedoras (decisión de arquitectura a favor — fase 2)` --references--> `ProveedorAdapter`  [INFERRED]
  docs/04_Esqueleto_Tecnico_Inicial.md → backend/src/proveedor/proveedor-adapter.interface.ts
- `8. Fuente descartada — recordatorio` --references--> `ProveedorAdapter`  [INFERRED]
  docs/05_Decisiones_Pendientes.md → backend/src/proveedor/proveedor-adapter.interface.ts

## Import Cycles
- None detected.

## Communities (193 total, 63 thin omitted)

### Community 0 - "RequestContextService"
Cohesion: 0.16
Nodes (3): mapDispositivoParaOperador(), mapDispositivoParaRevendedora(), DispositivosController

### Community 1 - "SensaAdapter"
Cohesion: 0.08
Nodes (11): ProveedorAdapter, Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar (+3 more)

### Community 2 - "sensa.adapter.ts"
Cohesion: 0.17
Nodes (17): OpcionesLlamada, CODIGOS_DNI_REPETIDO, CODIGOS_EMAIL_REPETIDO, CODIGOS_TRANSITORIOS, CODIGOS_VALIDACION, CONECTOR_SENSA, SENSA_CODIGOS, TOPE_DISPOSITIVOS_POR_CATEGORIA (+9 more)

### Community 3 - "PrismaService"
Cohesion: 0.07
Nodes (8): RequestContext, RequestContextService, PrismaService, InventarioProveedorService, IncidenciasDispositivosService, PortalApiKeyGuard, WhatsappBotService, SENSA_SERVICIOS

### Community 4 - "types.ts"
Cohesion: 0.08
Nodes (31): getUnlinkedProviderDevices(), puedeAgregarCliente(), Account, AccountCredentials, AccountDetail, AccountProviderDevice, AccountProviderInventory, CapacityAlert (+23 more)

### Community 5 - "cn"
Cohesion: 0.11
Nodes (34): HealthBadge(), Metric(), BarraCapacidad(), barraCapacidadClase(), CategoriaCapacidad, colorPrincipal(), Dashboard(), FilaMini() (+26 more)

### Community 6 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+17 more)

### Community 7 - "IPTVControl — Esqueleto Técnico Inicial"
Cohesion: 0.17
Nodes (11): 1. Entidades principales (borrador de modelo de datos), 2.1. Stack técnico confirmado, 2.2. Relaciones entre entidades, 2. Relaciones clave, 3.1. Identificadores requeridos por SENSA, 3. Integración con el Proveedor (SENSA) — patrón de conector desacoplado, 5. Vistas y requisitos de UX (a detallar con Federico), 6. Preguntas técnicas — estado actualizado (+3 more)

### Community 8 - "IPTVControl — Reglas de Negocio"
Cohesion: 0.13
Nodes (14): 10. Sobre el documento de tareas de Federico, 12. Alerta de Cuenta cerca del tope de capacidad, 13. Exportación de datos propios a CSV, 14. Datos registrados de la Empresa Revendedora, 3. Ciclo de vida de un Cliente Final / Dispositivo, 4.1. Primer Team Member root del Operador Principal, 4.2. Visibilidad del Operador Principal sobre Cuentas y Dispositivos — solo por ID técnico, 4. Aislamiento multi-tenant (+6 more)

### Community 9 - "IPTVControl — Guía de integración para el Portal de Cliente"
Cohesion: 0.08
Nodes (23): 10. Checklist del integrador, 11. Postman, 12. Preguntas frecuentes / límites conocidos, 1. Objetivo y alcance, 2. Lo que IPTVControl entrega al integrador, 3. Conceptos de negocio que el integrador debe entender, 4. Autenticación, 5. Modelo de errores (+15 more)

### Community 10 - "@prisma/client"
Cohesion: 0.15
Nodes (16): AuditService, RegistroAuditoria, DniRepetidoError, ETIQUETAS_ACCION, CoincidenciaGestionExterna, EMPRESA, CrearCuentaOpciones, SincronizacionContadoresPendienteError (+8 more)

### Community 11 - "cuentas.service.ts"
Cohesion: 0.12
Nodes (24): armarCategoria(), calcularCapacidad(), CapacidadCategoria, CapacidadCuenta, contarDispositivosCliente(), contarOcupados(), contarVentasActivas(), CuentaCapacidadInput (+16 more)

### Community 12 - "CrearClienteBotDto"
Cohesion: 0.06
Nodes (4): ProveedoresController, ProveedoresService, CrearClienteBotDto, DispositivoBotDto

### Community 14 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, auth0, bullmq, class-transformer, class-validator, compression, helmet, ioredis (+15 more)

### Community 15 - "migration.sql"
Cohesion: 0.12
Nodes (15): 10. Checklist del integrador, 11. Postman, 1. Objetivo, 2. Datos que recibe el integrador, 3. Endpoint, 4. Duplicados y reintentos, 5. Campos del request, 6. Modalidades (+7 more)

### Community 16 - "migration.sql"
Cohesion: 0.15
Nodes (3): metadatosDispositivoProveedor(), parsearUltimoInicioProveedor(), ColaProveedorProcessor

### Community 18 - "IPTVControl"
Cohesion: 0.13
Nodes (3): ActualizarRevendedoraDto, CambiarModalidadDto, CrearRevendedoraDto

### Community 19 - "devDependencies"
Cohesion: 0.09
Nodes (23): devDependencies, eslint, eslint-config-prettier, eslint-plugin-prettier, jest, @nestjs/cli, @nestjs/schematics, @nestjs/testing (+15 more)

### Community 20 - "tsconfig.build.json"
Cohesion: 0.50
Nodes (3): exclude, extends, ./tsconfig.json

### Community 21 - "decorators.ts"
Cohesion: 0.16
Nodes (8): CurrentUser, PUBLIC_KEY, Roles(), ROLES_KEY, SoloOperador(), JwtAuthGuard, TeamMemberGuard, @nestjs/core

### Community 22 - "CuentasProvisioningService"
Cohesion: 0.13
Nodes (7): CuentasProvisioningService, LimiteCreacionMensualError, SinCapacidadEnCuentaError, CuentaAisladaError, VentanasCuriosidadService, 4. Integración SENSA — casos límite, Puntos de enforcement en el backend

### Community 23 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, @auth0/auth0-react, class-variance-authority, clsx, date-fns, @hookform/resolvers, lucide-react, @radix-ui/react-dialog (+15 more)

### Community 25 - "configuration.ts"
Cohesion: 0.09
Nodes (21): 1. ¿Qué es IPTVControl y en qué estado está?, 2. Stack y topología actuales (Docker Compose local), 3. Variables de entorno, 4.1. Primer despliegue en una VPS nueva, 4.2. Actualización de código, 4.3. Cambio de datos de conexión SENSA / planes / modalidades, 4.4. Integración del bot de WhatsApp (alta de Clientes Finales por API), 4. Procedimientos de arranque / mantenimiento (+13 more)

### Community 26 - "csv.util.ts"
Cohesion: 0.22
Nodes (12): AgrupacionMetricas, dia, mes, semana, finDiaDesdeTexto(), inicioDiaArgentina(), inicioDiaDesdeTexto(), inicioMesDesdeInstante() (+4 more)

### Community 27 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+13 more)

### Community 29 - "backend/package.json"
Cohesion: 0.07
Nodes (31): description, eslint, @types/node, typescript, license, name, private, version (+23 more)

### Community 30 - "ConfiguracionService"
Cohesion: 0.04
Nodes (13): ConfiguracionController, ConfiguracionModule, ConfiguracionNotificacionesController, ConfiguracionPlantillaController, ConfiguracionRevendedorController, ConfiguracionService, crearServicio(), ActualizarConexionProveedorDto (+5 more)

### Community 31 - "primitives.tsx"
Cohesion: 0.31
Nodes (7): cifrar(), CODIGO_POR_NOMBRE, FilaCsv, invertirDni(), main(), mapearServicios(), prisma

### Community 32 - "ColaProveedorService"
Cohesion: 0.13
Nodes (14): CrearNotificacionParams, NotificacionesService, crearServicio(), COLA_PROVEEDOR, DatosCerrarCuenta, DatosEliminarDispositivo, DatosReconciliarDispositivos, DatosSincronizarContadoresVenta (+6 more)

### Community 33 - "CrearModalidadDto"
Cohesion: 0.10
Nodes (4): ActualizarModalidadDto, CrearModalidadDto, ListarModalidadesQueryDto, ModalidadesController

### Community 34 - "primitives.tsx"
Cohesion: 0.14
Nodes (41): Alert(), BadgeProps, badgeVariants, BotonProps, botonVariants, Card(), CardContent(), CardFooter() (+33 more)

### Community 35 - "devDependencies"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, jsdom (+12 more)

### Community 36 - "Capacidad de una Cuenta"
Cohesion: 0.11
Nodes (18): 10. Demo de 60 minutos (completa), 11. Funcionalidades principales (qué existe, verificado), 13. Clientes, 16. Errores (qué significan, cómo explicarlos), 17. Preguntas frecuentes (FAQ de la llamada), 18. Preguntas difíciles/incómodas (clasificadas), 1. Objetivo, 20. Errores comunes en los primeros días (+10 more)

### Community 37 - "api.ts"
Cohesion: 0.09
Nodes (29): ErrorDeValidacion(), esFaltaDePermiso(), esSesionInvalida(), Ingreso(), NotFound(), RequiereSesion(), SinAcceso(), estado (+21 more)

### Community 38 - "Registro de auditoría"
Cohesion: 0.11
Nodes (17): Cómo crece la obligación mensual, Las dos modalidades, Lo que el sistema NO hace, Modalidades comerciales, Precios, Ver también, Lo que no incluye el MVP, Quién consulta qué (+9 more)

### Community 39 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, format, import:micom, lint, lint:fix, prisma:generate, prisma:migrate (+10 more)

### Community 41 - "common.tsx"
Cohesion: 0.11
Nodes (29): ALTURAS_BARRA, CapacityMeter(), OcupacionCuenta, ProviderDeviceClassBadge(), tonoPorEstado, VinculacionEnCursoAlert(), WhatsappTemplateButton(), Tooltip() (+21 more)

### Community 43 - "DispositivosController"
Cohesion: 0.12
Nodes (18): ClasificacionDispositivoProveedor, DispositivoInventarioDto, InventarioProveedorDto, ConfiguracionProveedorResuelta, ActivarDispositivoParams, ActualizarCapacidadParams, ActualizarPasswordParams, ActualizarPinParams (+10 more)

### Community 44 - "ListarAuditoriaQueryDto"
Cohesion: 0.11
Nodes (3): AuditoriaController, AuditoriaService, ListarAuditoriaQueryDto

### Community 45 - "api"
Cohesion: 0.20
Nodes (35): 4.3. `/users` → `/team-members`: por qué el cambio de nombre, ConfirmDialog(), Dialog, DialogContent(), Select(), Button, Field(), Input (+27 more)

### Community 46 - "dispositivos.controller.ts"
Cohesion: 0.12
Nodes (12): ColumnaCsv, generarCsv(), responderCsv(), Fila, PaginatedResponse, CsvCliente, CsvDispositivo, DispositivosQueryService (+4 more)

### Community 47 - "CustomerDetail.tsx"
Cohesion: 0.23
Nodes (50): 4.1. Convención de nombres de componentes, AccountStatusBadge(), CopyableId(), CustomerStatusBadge(), DeviceStatusBadge(), DeviceTypeBadge(), ExportCsvButton(), PageHeader() (+42 more)

### Community 48 - "ClientesService"
Cohesion: 0.09
Nodes (4): ClientesController, ClientesService, ActualizarClienteDto, ListarClientesQueryDto

### Community 49 - "portal-cliente.controller.ts"
Cohesion: 0.34
Nodes (8): BajaDispositivoPortalDto, CambiarPasswordPortalDto, CambiarPinPortalDto, CambiarServiciosPortalDto, ReclamarDispositivoPortalDto, SesionPortalDto, SincronizarDispositivosPortalDto, @nestjs/throttler

### Community 50 - "@nestjs/common"
Cohesion: 0.06
Nodes (20): AuditModule, ContextModule, CryptoModule, PrismaModule, AuditoriaModule, ClientesModule, CuentasModule, DashboardModule (+12 more)

### Community 51 - ".transaction"
Cohesion: 0.20
Nodes (3): SoloRevendedor(), CuentasController, 3 · Seguridad de datos sensibles

### Community 52 - "README.md"
Cohesion: 0.12
Nodes (15): Acerca de, Aislamiento multi-tenant: cómo está garantizado, Arquitectura de la integración con el proveedor, Comandos habituales, Configurar Auth0 (paso previo al primer login), Convenciones de código (léelo antes de tocar algo), Desarrollo sin Docker, Documentación (+7 more)

### Community 54 - "4. Flujos principales (a diagramar en Mermaid en la documentación Obsidian)"
Cohesion: 0.15
Nodes (13): 11. Registro de auditoría (Audit Log), 4.1. Alta de Cliente Final — dos métodos, 4.2. Baja definitiva de Cliente Final, 4.3. Suspensión de Cliente Final, 4.4.1. Edición de tipo y servicios de una Cuenta existente, 4.4. Alta o venta adicional sin migración imposible, 4.5. Cambio de modalidad comercial o escala, 4.6. Provisioning del primer Team Member root (bootstrap) (+5 more)

### Community 55 - "Entidades (modelo de datos)"
Cohesion: 0.14
Nodes (13): Actores (roles de negocio), Cliente Final, Cuenta (Cuenta SENSA), Dispositivo, Empresa Revendedora, Entidades (modelo de datos), IPTVControl — Glosario de Actores y Entidades, Modalidad Comercial (+5 more)

### Community 58 - "LandingPage.tsx"
Cohesion: 0.17
Nodes (13): Cargando(), Brand(), capabilities, LandingPage(), SignalConsole(), steps, ThemeToggle(), ContextoTema (+5 more)

### Community 59 - "IPTVControl — URL Structure / Routing Convention"
Cohesion: 0.17
Nodes (11): 1. Principios aplicados, 2. Tabla de rutas, 3. Ejemplos de rutas anidadas resueltas por query param (no por segmento), 4.2. Dónde vive el mapeo español↔inglés en el código, 4.4. Excepción a la ruta `/team-members`: el primer Team Member root, 4. Decisión confirmada por Bruno: inglés en URLs y en componentes de UI, 5.1. `/audit-log`, 5.2. Exportación CSV (+3 more)

### Community 60 - "PortalClienteService"
Cohesion: 0.10
Nodes (4): Public(), HealthController, PortalClienteController, PortalClienteService

### Community 61 - "jest"
Cohesion: 0.18
Nodes (11): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+3 more)

### Community 62 - "Decisiones pendientes"
Cohesion: 0.20
Nodes (10): 1 · Comercial, 2 · Autenticación y provisioning (Auth0), 4 · Integración SENSA — casos límite, 5 · Parametrización — umbrales y validaciones, 6 · Menú de Parametrización, 7 · Documentación, Decisiones pendientes, Interpretación aplicada: el alta de Operadores Principales (+2 more)

### Community 63 - "calendario-comercial.ts"
Cohesion: 0.27
Nodes (9): bordeMesArgentina(), diferenciaZonaArgentina(), finMesArgentina(), inicioMesArgentina(), partesMesArgentina(), periodoMesArgentina(), ZONA_ARGENTINA, armarServicio() (+1 more)

### Community 64 - "IPTVControl — Instrucciones del Proyecto"
Cohesion: 0.22
Nodes (8): Alcance del MVP (primera etapa), Cómo quiero que Claude me responda en este Proyecto, Datos de la empresa (para cotizaciones, informes o material formal derivado de este proyecto), Documentos que forman parte de este Proyecto, Infraestructura y equipo de desarrollo, IPTVControl — Instrucciones del Proyecto, Qué es este proyecto, Stack tecnológico

### Community 65 - ".registrarEnTx"
Cohesion: 0.09
Nodes (3): CuentasService, tipoProveedorANormalizado(), ModalidadesService

### Community 67 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, lint, lint:fix, preview, test, test:watch (+1 more)

### Community 69 - "7. Demo paso a paso (lo que mostrás, decís, remarcás, evitás)"
Cohesion: 0.17
Nodes (12): 7.10 Errores y mensajes, 7.11 Cierre, 7.1 Login, 7.2 Dashboard, 7.3 Estructura — ir a Cuentas y abrir una compartida, 7.4 Concepto 1+1 / 2+2 y "pendientes", 7.5 Alta de cliente (wizard), 7.6 Resultado en la Cuenta (+4 more)

### Community 70 - "Capacidad de una Cuenta"
Cohesion: 0.22
Nodes (9): Alerta de "cerca del tope", Baja y suspensión, Capacidad de una Cuenta, Cómo se decide dónde entra un alta, Cómo se ve en el panel, Descubrimiento después del primer login, El mecanismo real de bloqueo: contadores nativos de SENSA, Límite real de los contadores de SENSA (confirmado 21/08/2026) (+1 more)

### Community 71 - "Integración con SENSA"
Cohesion: 0.22
Nodes (9): Base, Códigos de error relevantes, Dos limitaciones que condicionan el diseño, Integración con SENSA, Mapeo de capacidad, Métodos que usa IPTVControl, Paquetes de contenido (Anexo de Servicios), Validaciones de la API que el adapter sanea (+1 more)

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
Cohesion: 0.38
Nodes (5): cifrar(), crearUsuarioAuth0(), main(), prisma, auth0

### Community 78 - "Vault de Obsidian — IPTVControl"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 79 - "AccountDetail.tsx"
Cohesion: 0.15
Nodes (27): DetailRow(), SecretValue(), CuriosityDurationInput(), DurationParts, maxEfectivo(), normalizeMinutes(), Drawer(), Tabs (+19 more)

### Community 80 - "ContextModule"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 82 - "TeamMembersController"
Cohesion: 0.07
Nodes (4): Auth0ManagementService, CrearTeamMemberDto, ListarTeamMembersQueryDto, TeamMembersController

### Community 84 - "jwt.strategy.ts"
Cohesion: 0.25
Nodes (4): JwtPayload, JwtStrategy, jwks-rsa, passport-jwt

### Community 85 - "HU-P03 — Crear cuenta de prueba"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 86 - "HU-P04 — Tags de cuenta de prueba"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 87 - "@nestjs/bullmq"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 88 - "Despliegue y operación"
Cohesion: 0.22
Nodes (9): Backups, Despliegue y operación, Dos usuarios de base de datos, a propósito, Primer despliegue, Problemas que ya nos pasaron, Qué configurar en el panel después del seed, Servicios, Ver también (+1 more)

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

### Community 97 - "HU-D02 — Autoasignar dispositivo con un único cliente activo"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 98 - "HU-D03 — Notificar dispositivo con cero o varios clientes activos"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 99 - "HU-D04 — Recordatorios de dispositivos pendientes"
Cohesion: 0.18
Nodes (10): Alcance, Consideraciones para la IA, Contexto obligatorio del proyecto, Criterios de aceptación, Dependencias, Flujo esperado, Fuera de alcance / No tocar, Historia de usuario (+2 more)

### Community 100 - "nest-cli.json"
Cohesion: 0.25
Nodes (7): collection, compilerOptions, deleteOutDir, plugins, tsConfigPath, $schema, sourceRoot

### Community 101 - "MACHETE — Demo cliente IPTVControl"
Cohesion: 0.20
Nodes (9): ANTES DE EMPEZAR, CIERRE, INTRO (2 min), MACHETE — Demo cliente IPTVControl, MOSTRAR (en orden), NO PROMETER (si te preguntan), PREGUNTAS PROBABLES, RECORDAR EXPLICAR (+1 more)

### Community 103 - ".llamar"
Cohesion: 0.32
Nodes (3): EmailRepetidoError, ProveedorValidacionError, SensaEnvelope

### Community 104 - "IPTVControl — Decisiones Pendientes (consolidado)"
Cohesion: 0.25
Nodes (7): 1. Comercial / negocio, 3. Seguridad de datos sensibles, 5. Parametrización — umbrales y validaciones, 6. Menú de Parametrización — conexión SENSA (`04_Esqueleto_Tecnico_Inicial.md`, sección 9), 7. Documentación / infraestructura de trabajo, 8. Fuente descartada — recordatorio, IPTVControl — Decisiones Pendientes (consolidado)

### Community 105 - "crearProteccionSwagger"
Cohesion: 0.19
Nodes (9): AppModule, crearProteccionSwagger(), iguales(), logger, OpcionesSwagger, bootstrap(), compression, helmet (+1 more)

### Community 106 - "FAQ — IPTVControl para Empresa Revendedora"
Cohesion: 0.22
Nodes (8): Acceso y seguridad, Clientes, Cuentas, Dispositivos y 1+1 / 2+2, FAQ — IPTVControl para Empresa Revendedora, Mensajes y errores, Otras funciones, Ventana de Alta

### Community 108 - "verificar-rls.sql"
Cohesion: 0.15
Nodes (3): TransactionClient, IdentificadoresService, PruebasService

### Community 110 - "frontend/package.json"
Cohesion: 0.06
Nodes (35): description, eslint, @types/node, typescript, name, private, type, version (+27 more)

### Community 115 - "Flujo — Alta de Cliente Final"
Cohesion: 0.25
Nodes (8): Carga manual en una Cuenta compartida vacía, Descubrimiento del Dispositivo, El identificador tipo DNI, Flujo — Alta de Cliente Final, Los cuatro pasos del asistente, Los dos métodos de alta, Si el Proveedor falla, Ver también

### Community 116 - "revendedoras.service.ts"
Cohesion: 0.15
Nodes (9): InvitacionTeamMember, AuthModule, ListarRevendedorasQueryDto, MetricasRevendedoraQueryDto, PuntoMetricas, ResultadoInvitacion, ResultadoReactivacion, TeamMembersService (+1 more)

### Community 117 - "Orden recomendado de implementación"
Cohesion: 0.25
Nodes (7): IPTVControl — Historias de usuario: Aislamiento, Cuentas de Prueba, Notificaciones y Dispositivos, Orden recomendado de implementación, Reglas transversales cerradas, Épica A — Aislamiento, Épica B — Cuentas de prueba, Épica C — Notificaciones, Épica D — Dispositivos

### Community 118 - "overlays.tsx"
Cohesion: 0.13
Nodes (30): AppLayout(), ItemMenu, ITEMS, Logo(), MenuUsuario(), NavItems(), ThemeToggle(), DialogClose (+22 more)

### Community 119 - "integracion-whatsapp.module.ts"
Cohesion: 0.19
Nodes (3): IdentidadCuentasService, IdentidadFicticia, xlsx

### Community 121 - "configuracion.service.ts"
Cohesion: 0.29
Nodes (8): PLANTILLA_DEFAULT_WHATSAPP, renderizarPlantilla(), TOKENS_PLANTILLA_WHATSAPP, validarPlantilla(), ValoresPlantilla, ClienteCreadoConCuenta, CuentaDelCliente, ResultadoAltaBot

### Community 122 - "ProveedorRateLimiterService"
Cohesion: 0.15
Nodes (13): MENSAJE_PROVEEDOR_CAIDO, ProveedorAutenticacionError, ProveedorNoDisponibleError, ReintentosDniAgotadosError, BotErrorFilter, CodigoErrorBot, conCodigo(), crearRespuestaErrorBot() (+5 more)

### Community 123 - "IPTVControl"
Cohesion: 0.29
Nodes (6): Ejecución, Fuentes de verdad, IPTVControl, Reglas obligatorias, Respuesta final, Uso de contexto

### Community 124 - "migration.sql"
Cohesion: 0.29
Nodes (7): 19. Decisiones de diseño (por qué se hizo así), DECISIÓN: Aislamiento por empresa, DECISIÓN: Contraseña compartida sin rotación, DECISIÓN: Errores importantes dentro del formulario, DECISIÓN: Los "pendientes" no se guardan como dispositivos, DECISIÓN: Todo el flujo contra un proveedor real sin modo prueba, DECISIÓN: Ventas 1+1/2+2 y Cuentas compartidas

### Community 127 - "2. Ciclo de vida de una Cuenta"
Cohesion: 0.29
Nodes (7): 2.1. Dos métodos de alta de Cliente Final, 2.2. Bloqueo de capacidad vía contadores de SENSA y descubrimiento del Dispositivo, 2.3.1. Edición de propiedades de una Cuenta existente, 2.3. Alta de Dispositivo adicional para un Cliente Final ya existente, 2.4. Identificador (DNI), credenciales y datos enviados a SENSA, 2.5. Validación de duplicados por ID de sistema de gestión externo, 2. Ciclo de vida de una Cuenta

### Community 128 - "Entidades"
Cohesion: 0.29
Nodes (7): Actores, Cuenta, Dispositivo, Entidades, Glosario de actores y entidades, Relación Cuenta – Dispositivo – Cliente Final, Ver también

### Community 129 - "Riesgo aceptado — contraseña compartida sin rotación"
Cohesion: 0.29
Nodes (7): Alcance de la decisión, El riesgo, Por qué se acepta, Qué hace el sistema al respecto, Relación con la Ventana de curiosidad (Fase 2), Riesgo aceptado — contraseña compartida sin rotación, Ver también

### Community 131 - "whatsapp-bot.controller.ts"
Cohesion: 0.12
Nodes (8): BotApiKeyGuard, BOT_REDIS_CLIENT, BotRateLimitExcedidoError, BotRateLimitService, BotRedisClient, BotRedisService, IntegracionWhatsappModule, @nestjs/config

### Community 132 - "9. Menú de Parametrización — Conexión con SENSA"
Cohesion: 0.33
Nodes (6): 9.1. Campos del formulario, 9.2. Botón "Probar conexión", 9.3. Endpoints de backend (placeholder, no implementado), 9.4. Prototipo de referencia, 9.5. Pendiente, 9. Menú de Parametrización — Conexión con SENSA

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
Cohesion: 0.47
Nodes (5): AppConfig, configuration(), toBool(), toInt(), validateConfig()

### Community 137 - "Ciclo de vida del Cliente Final"
Cohesion: 0.33
Nodes (6): Baja individual de un Dispositivo, Ciclo de vida del Cliente Final, La regla permanente, Orden de las operaciones (y por qué), Qué hace el sistema en cada transición, Ver también

### Community 138 - "Aislamiento multi-tenant"
Cohesion: 0.33
Nodes (6): Aislamiento multi-tenant, Cómo se activa el contexto, Dos capas de defensa, Qué ve el Operador Principal (tabla normativa), Ver también, Verificación

### Community 139 - "Consistencia con el Proveedor"
Cohesion: 0.33
Nodes (6): Casos especiales, Cola de reintentos (BullMQ), Consistencia con el Proveedor, El orden de las operaciones no es arbitrario, Panel de salud, Ver también

### Community 141 - "Patrón ProveedorAdapter"
Cohesion: 0.33
Nodes (6): El contrato, Extensión: la API pública de fase 2, Lo que el adapter traduce (y la lógica de negocio nunca ve), Patrón ProveedorAdapter, Por qué importa, Ver también

### Community 142 - "Arranque en frío y seed"
Cohesion: 0.33
Nodes (6): Arranque en frío y seed, El problema del huevo y la gallina, El seed, Invitación del resto del equipo, Salvaguarda del último administrador, Ver también

### Community 144 - "IPTVControl — Índice del vault"
Cohesion: 0.40
Nodes (5): Convenciones de este vault, IPTVControl — Índice del vault, Las cinco reglas que más se consultan, Mapa del sistema, Por dónde empezar

### Community 145 - "20260814120000_init/migration.sql"
Cohesion: 0.05
Nodes (73): "audit_log", audit_log_accion_creado_en_idx, audit_log_empresa_revendedora_id_creado_en_idx, audit_log_entidad_afectada_entidad_id_idx, "cliente_final", cliente_final_empresa_revendedora_id_estado_idx, cliente_final_empresa_revendedora_id_id_gestion_externo_idx, cliente_final_empresa_revendedora_id_numero_cliente_key (+65 more)

### Community 147 - "Team Members"
Cohesion: 0.40
Nodes (5): Estados, Por qué no se llama "usuario", Roles, Team Members, Ver también

### Community 149 - "@nestjs/swagger"
Cohesion: 0.06
Nodes (9): PaginationQueryDto, AislarCuentaDto, CambiarPasswordCuentaDto, CambiarPinCuentaDto, ListarCuentasQueryDto, ActualizarSonidoNotificacionesDto, class-transformer, class-validator (+1 more)

### Community 150 - "Validación de ID de gestión externa"
Cohesion: 0.40
Nodes (5): Alcance de la búsqueda, En el panel, La regla: avisar, no decidir, Validación de ID de gestión externa, Ver también

### Community 151 - "Stack técnico"
Cohesion: 0.40
Nodes (5): Convenciones de rutas, Dos vocabularios, a propósito, Estructura del repositorio, Stack técnico, Ver también

### Community 152 - "Ventana de curiosidad (Fase 2)"
Cohesion: 0.40
Nodes (5): Alcance, Ciclo de vida, Historial, Ventana de curiosidad (Fase 2), Ver también

### Community 153 - "Vault de Obsidian — IPTVControl"
Cohesion: 0.40
Nodes (4): Cómo abrirlo, Estructura, Relación con `docs/`, Vault de Obsidian — IPTVControl

### Community 154 - "Ciclo de vida del Cliente Final"
Cohesion: 0.67
Nodes (3): 3.1 El concepto central es la CUENTA, 3.2 Quién ve qué, 3. Modelo mental del sistema

### Community 155 - "Modalidades comerciales"
Cohesion: 0.67
Nodes (3): 4.1 Actores reales **[CONFIRMADO en enums + guards]**, 4.2 Aislamiento (cómo se explica), 4. Roles y permisos

### Community 156 - "5. Preparación antes de la llamada"
Cohesion: 0.67
Nodes (3): 5.1 Checklist, 5.2 Datos de demostración sugeridos, 5. Preparación antes de la llamada

### Community 168 - "15. Ventana de curiosidad (Fase 2)"
Cohesion: 0.50
Nodes (4): 15.1. Aislar Cuenta (venta compartida dedicada), 15.2. Apertura manual de una Ventana de Alta, 15.3. Aislamiento de una Cuenta compartida existente, 15. Ventana de curiosidad (Fase 2)

### Community 169 - "1. Modalidades comerciales"
Cohesion: 0.50
Nodes (4): 1.1. Al menudeo (sin obligación de ventas mensuales), 1.2. Con obligación de ventas mensuales (escala creciente, ej. X5 / X10), 1.3. Precios, 1. Modalidades comerciales

### Community 170 - "Flujo — Dispositivo adicional sin migración imposible"
Cohesion: 0.50
Nodes (4): Flujo — Dispositivo adicional sin migración imposible, Regla central, Venta compartida, Ver también

## Knowledge Gaps
- **38 isolated node(s):** `@nestjs/platform-express`, `passport`, `rxjs`, `@nestjs/cli`, `@nestjs/schematics` (+33 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1237 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **63 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ProveedorAdapter` connect `SensaAdapter` to `sensa.adapter.ts`, `IPTVControl — Esqueleto Técnico Inicial`, `IPTVControl — Reglas de Negocio`, `Patrón ProveedorAdapter`, `decorators.ts`, `DispositivosController`, `README.md`, `Decisiones pendientes`, `IPTVControl`, `HU-A02 — Aislar cuenta compartida existente`, `HU-A03 — Vencimiento y revocación de aislamiento`, `IPTVControl — Índice del vault`, `CryptoService`, `Vault de Obsidian — IPTVControl`, `ContextModule`, `HU-P03 — Crear cuenta de prueba`, `HU-P04 — Tags de cuenta de prueba`, `@nestjs/bullmq`, `HU-P07 — Auditoría del ciclo de cuentas de prueba`, `HU-N01 — Centro de notificaciones persistentes`, `HU-N02 — Configuración de notificaciones`, `HU-N03 — Avisos de cuentas de prueba por vencer`, `HU-N04 — Avisos de ventana de alta por vencer`, `HU-N05 — Preferencias de usuario y sonido`, `ClientesService`, `HU-D02 — Autoasignar dispositivo con un único cliente activo`, `HU-D03 — Notificar dispositivo con cero o varios clientes activos`, `HU-D04 — Recordatorios de dispositivos pendientes`, `IPTVControl — Decisiones Pendientes (consolidado)`, `Orden recomendado de implementación`, `IPTVControl`?**
  _High betweenness centrality (0.312) - this node is a cross-community bridge._
- **What connects `@nestjs/platform-express`, `passport`, `rxjs` to the rest of the system?**
  _38 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SensaAdapter` be split into smaller, more focused modules?**
  _Cohesion score 0.07977207977207977 - nodes in this community are weakly interconnected._
- **Why does `@nestjs/common` connect `@nestjs/common` to `sensa.adapter.ts`, `PrismaService`, `whatsapp-bot.controller.ts`, `@prisma/client`, `cuentas.service.ts`, `decorators.ts`, `@nestjs/swagger`, `backend/package.json`, `ConfiguracionService`, `ColaProveedorService`, `DispositivosController`, `dispositivos.controller.ts`, `portal-cliente.controller.ts`, `PortalClienteService`, `jwt.strategy.ts`, `crearProteccionSwagger`, `revendedoras.service.ts`, `integracion-whatsapp.module.ts`, `ProveedorTelemetryService`, `configuracion.service.ts`, `ProveedorRateLimiterService`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **Should `PrismaService` be split into smaller, more focused modules?**
  _Cohesion score 0.06972789115646258 - nodes in this community are weakly interconnected._
- **Why does `Convenciones de código (léelo antes de tocar algo)` connect `README.md` to `SensaAdapter`, `primitives.tsx`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0766488413547237 - nodes in this community are weakly interconnected._