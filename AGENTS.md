# IPTVControl

Plataforma multi-tenant de gestión de reventa de cuentas IPTV, desarrollada por
**TECNOLOGIA ACTIVA S.A.S.** (Godoy Cruz, Mendoza) sobre la plataforma de contenido **SENSA**.
Automatiza el ciclo de vida de Cuentas/Dispositivos/Clientes Finales entre un Operador Principal
y sus Empresas Revendedoras, diseñada desde el inicio para escalar a otros distribuidores y,
en el futuro, a otros proveedores de contenido además de SENSA.

**Objetivo del sistema:** que la operación de venta y gestión de cuentas/dispositivos funcione sin
intervención manual del Operador Principal en el día a día.

## Stack técnico

- **Backend:** NestJS sobre Node.js (módulos, DI, guards) — Swagger/OpenAPI nativo, expuesto en
  `/api/docs` (solo con login).
- **Base de datos:** PostgreSQL — Row-Level Security nativo para aislamiento multi-tenant.
- **ORM:** Prisma — sin soporte nativo de RLS, se combina con `SET app.current_tenant` por
  request (middleware NestJS) + políticas RLS en Postgres como segunda capa.
- **Colas:** BullMQ + Redis — reintentos ante fallas de la API de SENSA.
- **Autenticación:** Auth0 + JWT (tenant nuevo, propio de Tecnología Activa).
- **Frontend:** Vite + React + shadcn/ui + TanStack Query + React Router (sin Next.js — no hace
  falta SSR en un panel administrativo interno).
- **Infraestructura:** VPS propio + Docker / Docker Compose. Sin Kubernetes ni microservicios
  (sobre-ingeniería para el volumen esperado: ~10 Empresas Revendedoras, ~9.000 Clientes Finales).
- **Encriptación:** credenciales de Cuenta SENSA en AES-256-GCM a nivel aplicación (clave maestra
  fuera del repo).
- **Control de versiones:** GitHub, cuenta de Tecnología Activa. Repo/paquete: `iptvcontrol`
  (sin prefijo de marca). Branching trunk-based simplificado (`main` + `feature/xxx` cortas).
- **Ambientes:** producción controlada desde el arranque, sin staging separado. Pruebas de
  integración con SENSA van **directo contra producción de SENSA**, con Cuentas ya abonadas por
  Tecnología Activa (no hay modo dry-run).
- **Idioma de interfaz:** español únicamente (sin multi-idioma en el MVP).

## Terminología: español en backend, inglés en frontend

El glosario oficial del negocio es en **español** (`Cuenta`, `Dispositivo`, `Cliente Final`,
`Empresa Revendedora`...) y así se nombra en base de datos, lógica de negocio y documentación —
ver @docs/02_Glosario_de_Actores_y_Entidades.md. Las rutas y componentes del **frontend** usan
nombres genéricos en **inglés** (`/customers`, `/devices`, `CustomerForm`...) — ver
@docs/IPTVControl_URL_Routing_Convention.md. El mapeo entre ambos vive centralizado en
`entityLabels.ts`. No mezclar los dos criterios fuera de su capa correspondiente.

## Patrón central: ProveedorAdapter

Toda integración con SENSA pasa por una interfaz `ProveedorAdapter` (crear cuenta, actualizar
dispositivos, activar dispositivo, consultar estado), implementada hoy únicamente por
`SensaAdapter`. La lógica de negocio **nunca** debe hablarle directo a la API de SENSA — esto es
lo que permite sumar otros Proveedores en el futuro sin tocar el núcleo del sistema. Mismo
criterio aplica a los casos de uso: deben vivir en servicios NestJS independientes de los
controllers HTTP, para que una futura API pública (fase 2, no MVP) sea solo agregar controllers
nuevos sobre los mismos servicios. Detalle completo: @docs/04_Esqueleto_Tecnico_Inicial.md
(secciones 3 y 8).

## Identidad visual

Logo definitivo en `branding/logo_iptvcontrol.png` (isotipo nube + pantalla/monitoreo, paleta
azul/negro, tagline "MONITOREO · GESTIÓN · CONTROL") — **confirmado por Bruno**. Esto actualiza lo
que dice `docs/01_Instrucciones_del_Proyecto.md` ("identidad visual: sin definir todavía, no hay
logo"), que quedó desactualizado en ese punto puntual; el resto del documento sigue vigente. No
hay, por ahora, un manual de marca completo (paleta extendida, tipografías, variantes del logo)
más allá de este archivo — si Federico necesita variantes (fondo oscuro, solo isotipo, etc.),
consultarlo con Bruno antes de generarlas por cuenta propia.

## Estructura del repositorio (implementada)

```
iptvcontrol/
├── AGENTS.md · opencode.json · README.md
├── docs/                      → documentación normativa (fuente de verdad)
├── vault/                     → vault de Obsidian: mismos conceptos, con diagramas Mermaid
├── graphify-out/              → knowledge graph del repo (memoria entre sesiones)
├── branding/logo_iptvcontrol.png
├── docker/postgres/init/      → crea el usuario de aplicación SIN BYPASSRLS
├── docker-compose.yml
├── backend/                   → NestJS + Prisma + BullMQ
│   ├── prisma/
│   │   ├── schema.prisma           → modelo en español (glosario oficial)
│   │   ├── migrations/             → init + RLS multi-tenant
│   │   ├── seed-root.ts            → npm run seed:root (arranque en frío)
│   │   └── verificar-rls.sql       → prueba manual del aislamiento
│   └── src/
│       ├── common/                 → config · crypto (AES-256-GCM) · prisma · auth · audit · errores · csv
│       ├── proveedor/              → ProveedorAdapter + SensaAdapter + rate limiter + telemetría
│       ├── queues/                 → BullMQ: reintentos y reconciliación por polling
│       └── modules/                → cuentas · clientes · dispositivos · revendedoras ·
│                                     modalidades · team-members · configuracion · auditoria ·
│                                     reportes · dashboard · health
└── frontend/                  → Vite + React + shadcn/ui + TanStack Query
    └── src/
        ├── i18n/entityLabels.ts    → ÚNICO punto de cruce español ↔ inglés
        ├── lib/                    → api · session (Auth0) · theme · types · utils
        ├── components/             → ui/ (primitivos) · CapacityMeter · common · layout
        └── features/               → dashboard · resellers · accounts · customers · devices ·
                                      commercial-plans · providers · team-members · audit-log ·
                                      reports · settings
```

Comandos habituales:

| Qué | Dónde | Comando |
|---|---|---|
| Tests | `backend/` y `frontend/` | `npm test` |
| Typecheck | ambos | `npm run typecheck` |
| Lint | ambos | `npm run lint` |
| Build | ambos | `npm run build` |
| Migraciones | `backend/` | `npm run prisma:migrate` |
| Seed inicial | `backend/` | `npm run seed:root` |

## Herramientas de contexto: Graphify y el vault de Obsidian

**Graphify** mantiene un knowledge graph del repo en `graphify-out/`. Es la herramienta
**por defecto** para entender el código en este repo — antes de leer archivos completos a mano o
salir a buscar con grep a ciegas, conviene consultar el grafo primero:

```bash
graphify update .                          # reconstruir tras cambios de código
graphify query "alta de Cliente Final"     # recorrido por el grafo (flujos, conceptos)
graphify explain "SensaAdapter"            # explicación de un nodo y sus vecinos directos
graphify affected "capacidad.util"         # qué le pega si toco este símbolo/archivo
```

**Uso obligatorio, no solo al final de la tarea:**

- **Antes de orientarse en código desconocido o retomar una sesión**, usar
  `graphify explain "<Módulo/Clase/Componente>"` o `graphify query "<concepto de negocio>"` en vez
  de releer archivos completos de punta a punta. Es la forma barata de trabajar en este repo.
- **Antes de modificar un archivo compartido** (un `*.util.ts`, una interfaz, un servicio con
  varios consumidores — ej. `capacidad.util.ts`, `ProveedorAdapter`, `DispositivosService`), correr
  `graphify affected "<símbolo>"` para no dejar afuera un caller del radar. El caso real que lo
  justifica: en el rediseño de capacidad (24/08/2026) un caller de `tipoLocal` en
  `IncidenciasDispositivosService` quedó sin actualizar en la primera pasada porque no se consultó
  el grafo de dependencias antes de tocar el mapeo de tipos.
- **Después de un cambio de código relevante**, correr `graphify update .` para que la próxima
  sesión arranque con el grafo al día — esto ya estaba, sigue vigente.
- Si el grafo no tiene la respuesta o queda ambiguo, ahí sí corresponde leer el archivo completo o
  usar el agente `explore` — Graphify es el primer paso, no reemplaza la lectura cuando hace falta
  precisión línea por línea (ej. antes de un `edit`, siempre se lee el archivo real con la
  herramienta de lectura, nunca se edita solo en base a lo que dice el grafo).

El comando `graphify install --platform opencode` escribe en la configuración global del usuario
(fuera del repo) y **no se ejecutó**: si se lo quiere como skill permanente, lo corre el desarrollador
a mano.

**El vault de `vault/`** es la capa de navegación y diagramas de la misma información de `docs/`.
Cuando haya discrepancia, **manda `docs/`**. Si se cierra una decisión o se agrega un flujo, actualizar
las dos: el documento de `docs/` (normativo) y la nota del vault (explicativa).

## Documentación relacionada

Documentos que se cargan siempre en cada sesión (ver `opencode.json` → `instructions`):

- `docs/01_Instrucciones_del_Proyecto.md` — alcance completo del MVP (incluido / fuera de
  alcance), equipo, infraestructura, criterios de respuesta para el agente.
- `docs/02_Glosario_de_Actores_y_Entidades.md` — nomenclatura oficial de actores y entidades.
  La unidad oficial es "Dispositivo"; para capacidad libre se usa "cupo".
- `docs/03_Reglas_de_Negocio.md` — modalidades comerciales, ciclo de vida de Cuenta/Cliente Final,
  aislamiento multi-tenant, manejo de errores de SENSA, Audit Log, exportación CSV.
- `docs/04_Esqueleto_Tecnico_Inicial.md` — modelo de datos preliminar, patrón `ProveedorAdapter`,
  flujos principales, provisioning de Team Members, Menú de Parametrización SENSA.
- `docs/IPTVControl_URL_Routing_Convention.md` — convención de rutas y nombres de componentes
  del frontend (inglés, kebab-case, nesting máximo de 1 nivel).
- `docs/05_Decisiones_Pendientes.md` — **todo** lo que todavía no está cerrado. Consultar antes
  de asumir cualquier criterio no explícito en el resto de la documentación.

Para el detalle completo de la API del Proveedor (endpoints, autenticación, rate limits):
@docs/API_Sensa_V4_1_3.pdf

## Decisiones pendientes / a confirmar

**No asumir resoluciones para estos puntos.** Lista completa y actualizada en
@docs/05_Decisiones_Pendientes.md. Los más relevantes para empezar a programar:

- **Mecanismo de provisioning del primer Team Member root** (seed manual vs. automático en
  `docker-compose up`) — a definir con Federico.
- **Resguardo de contraseña/PIN de Cuenta** mostrados en el panel — control de acceso y registro
  de consultas sin definir.
- **Modelo de licenciamiento** del software hacia otros distribuidores — pendiente de definición
  comercial por parte de Bruno, no técnica.

## Fuente descartada

El documento de tareas preparado por Federico **no debe usarse** para planificar ni ejecutar
tareas: contradice decisiones ya confirmadas (módulo de facturación fuera de MVP, X5/X10 vs.
FULL/RETAIL, baja individual de dispositivo, ausencia del `ProveedorAdapter`). La única fuente de
verdad es esta documentación (`AGENTS.md` + `docs/`) más `API_Sensa_V4_1_3.pdf`.

## Equipo

- **Bruno** — dueño de Tecnología Activa. Administración general, legales, RRHH, pagos y compras.
  Nivel principiante en programación.
- **Federico** — lidera el equipo de desarrollo.
- Equipo operativo actual: **un desarrollador operando con opencode** (conocimientos básicos del
  negocio) + **un tester** dedicado a control de calidad antes de pasar a producción.
- Prioridad general: velocidad de entrega por sobre testing automatizado exhaustivo o cronograma
  formal por sprints (se organiza por épicas/módulos, sin fechas fijas).
