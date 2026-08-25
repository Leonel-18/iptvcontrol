<p align="center">
  <img src="branding/logo_iptvcontrol.png" alt="IPTVControl" width="260"/>
</p>

<h1 align="center">IPTVControl</h1>

<p align="center">
  <b>Plataforma multi-tenant de gestión de reventa de cuentas IPTV</b><br/>
  Automatiza el ciclo de vida de <b>Cuentas</b>, <b>Dispositivos</b> y <b>Clientes Finales</b> entre
  un Operador Principal y sus Empresas Revendedoras.
</p>

<p align="center">
  Desarrollado por <b>TECNOLOGIA ACTIVA S.A.S.</b> (Godoy Cruz, Mendoza) ·
  Integración inicial con la plataforma de contenido <b>SENSA</b>
</p>

---

## ¿Qué es IPTVControl?

IPTVControl es un software que permite a un **Operador Principal** (hoy, Tecnología Activa) vender
cuentas IPTV a **Empresas Revendedoras** (típicamente ISPs), quienes a su vez las revenden a sus
propios **Clientes Finales** (los abonados que efectivamente consumen el servicio).

El objetivo central: que la operación diaria de alta, baja, suspensión y reasignación de
cuentas/dispositivos **funcione sin intervención manual del Operador Principal**. Todo se automatiza
contra la API del proveedor de contenido (SENSA), con reintentos y consistencia garantizada.

```
Operador Principal (Tecnología Activa)
    └── Empresas Revendedoras (ISPs)            ← tenant aislado, panel y login propios
            └── Clientes Finales (abonados)     ← sin acceso al sistema
                    └── Dispositivos            ← máximo global de 3 por Cuenta
```

**Glosario mínimo** (el completo está en `docs/02_Glosario_de_Actores_y_Entidades.md`):

| Término | Significado |
|---|---|
| **Cuenta** | Unidad de contratación con el proveedor (SENSA). Un usuario, contraseña de 8 dígitos y PIN de 6 dígitos, con capacidad global de 3 Dispositivos. Es lo que se factura de Operador a Revendedor. |
| **Dispositivo** | El aparato físico (TV o móvil) de un Cliente Final dentro de una Cuenta. Se identifica por el ID que devuelve SENSA. |
| **Cliente Final** | El abonado que consume el servicio. No tiene acceso al sistema. |
| **Empresa Revendedora** | El ISP intermediario. Opera bajo una sola modalidad comercial. |
| **Operador Principal** | Titular del contrato con el proveedor y dueño de la plataforma. |
| **Team Member** | Login con permisos para entrar a un panel (no confundir con Cliente Final). |

---

## Funcionalidades del MVP

- Alta de Cliente Final por **dos métodos**: Cuenta completa exclusiva para un único cliente, con
  hasta 3 Dispositivos y todos los servicios contratados, o venta unitaria de exactamente 1
  Dispositivo dentro de una Cuenta compartida con firma de servicios idéntica.
- Alta como **wizard** paso a paso: la venta unitaria permite elegir servicios y siempre incluye el
  básico código 1; no solicita tipo ni MAC.
- Protección de los cupos no vendidos de Cuentas compartidas con Dispositivos de reserva técnicos:
  2 reservas con una venta, 1 con dos y ninguna con tres.
- Generación automática del **identificador tipo DNI** y del **correo de contacto** que SENSA exige
  (números parametrizables por el Operador Principal).
- Descubrimiento del Dispositivo al primer login: SENSA reporta ID, MAC y tipo; IPTVControl sondea
  cada 30 segundos durante 10 minutos. En venta unitaria resuelve candidato único o alta ambigua;
  en Cuenta completa puede vincular hasta 3 candidatos al mismo cliente.
- Alta de Dispositivos adicionales sin migrar cuatro equipos a una Cuenta: al llegar al máximo
  global de 3, la venta adicional usa otra Cuenta compatible.
- **Baja definitiva** de Cliente Final (libera capacidad comercial) y **suspensión**
  (bloquea el Dispositivo; la única salida es la transición explícita a baja).
- Panel del **Operador Principal**: dashboard (cuentas vendidas/disponibles/bloqueadas), salud de la
  integración con SENSA, alta de Empresas Revendedoras, planes comerciales, auditoría. Desktop-first.
- Panel de la **Empresa Revendedora**: 100% responsive, vista por Cuenta y por Cliente
  (usuario/contraseña/PIN, parametrización de contenido), alerta de Cuenta cerca del tope,
  exportación a **CSV**.
- Aislamiento **multi-tenant** total entre Empresas Revendedoras (Row-Level Security de PostgreSQL
  + scope por token de sesión).
- **Audit Log**: trazabilidad de altas/bajas/suspensiones, cambios de modalidad y precios.
- **Modo claro y modo oscuro** en toda la interfaz.

> Lo explícitamente **fuera** del MVP (facturación, API pública con API keys, multi-proveedor,
> licenciamiento a otros distribuidores) está documentado en
> `docs/01_Instrucciones_del_Proyecto.md`.

---

## Stack tecnológico

| Capa | Tecnología | Para qué |
|---|---|---|
| Backend | **NestJS** (Node.js 22) | API REST, módulos, DI, guards, Swagger en `/api/docs` |
| Base de datos | **PostgreSQL** | Row-Level Security nativo para el aislamiento multi-tenant |
| ORM | **Prisma** (+ RLS en Postgres como segunda capa) | Modelo de datos y migraciones |
| Colas | **BullMQ + Redis** | Reintentos y reconciliación ante fallas de la API de SENSA |
| Autenticación | **Auth0** (OAuth 2.0 / OIDC + JWT) | Logins de paneles e invitaciones de Team Members |
| Frontend | **Vite + React + shadcn/ui + TanStack Query + React Router** | Dos paneles (Operador / Revendedor) |
| Infraestructura | **Docker / Docker Compose** en VPS propio | Despliegue completo en una sola línea |
| Encriptación | **AES-256-GCM** a nivel aplicación | Credenciales de cuentas SENSA en la base |

### Arquitectura de la integración con el proveedor

Toda comunicación con SENSA pasa por una interfaz común **`ProveedorAdapter`**, implementada hoy
únicamente por **`SensaAdapter`**. La lógica de negocio **nunca** habla directo con la API de SENSA:
esto permite sumar otros proveedores en el futuro sin tocar el núcleo del sistema.

```
Lógica de negocio (servicios NestJS)
        │
        ▼
ProveedorAdapter  ← contrato común (crear cuenta, activar dispositivo, consultar estado…)
        │
        ▼
SensaAdapter      ← única implementación en el MVP
```

---

## Estructura del repositorio

```
iptvcontrol/
├── README.md · AGENTS.md · opencode.json · docker-compose.yml
├── branding/                  → logo oficial
├── docs/                      → DOCUMENTACIÓN NORMATIVA (fuente de verdad)
├── vault/                     → vault de Obsidian (lo mismo, con diagramas Mermaid)
├── graphify-out/              → knowledge graph del repo (memoria entre sesiones de opencode)
├── docker/postgres/init/      → crea el usuario de aplicación SIN BYPASSRLS
├── backend/                   → API NestJS + Prisma + BullMQ (español en modelo y lógica)
│   ├── prisma/
│   │   ├── schema.prisma      → modelo de datos (glosario oficial en español)
│   │   ├── migrations/        → migraciones (init + RLS multi-tenant)
│   │   ├── seed-root.ts       → primer Team Member root (npm run seed:root)
│   │   └── verificar-rls.sql  → prueba manual del aislamiento
│   └── src/
│       ├── common/            → config · crypto (AES-256-GCM) · prisma · auth · audit · errores · csv
│       ├── proveedor/         → ProveedorAdapter + SensaAdapter + rate limiter + telemetría
│       ├── queues/            → BullMQ: reintentos y reconciliación por polling
│       └── modules/           → cuentas · clientes · dispositivos · revendedoras · modalidades ·
│                                team-members · configuracion · auditoria · reportes · dashboard · health
└── frontend/                  → Vite + React + shadcn/ui (rutas y componentes en inglés genérico)
    └── src/
        ├── i18n/entityLabels.ts   → ÚNICO punto de cruce español ↔ inglés (UI)
        ├── lib/                   → api · session (Auth0) · theme · types · utils
        ├── components/            → ui/ (primitivos) · CapacityMeter · common · layout
        └── features/              → dashboard · resellers · accounts · customers · devices ·
                                     commercial-plans · providers · team-members · audit-log ·
                                     reports · settings
```

---

## Puesta en marcha (Docker — la vía normal)

**Requisitos:** Docker y Docker Compose. No hace falta tener Node instalado para correr el stack.

```bash
# 1. Crear las variables de entorno desde el ejemplo
cp .env.example .env
```

Completar **como mínimo** las siguientes variables (se explican en el apartado de abajo):

| Variables | Cómo obtenerlas |
|---|---|
| `POSTGRES_PASSWORD`, `APP_DB_PASSWORD` | A elección (no importan fuera de tu máquina) |
| `ENCRYPTION_MASTER_KEY` | `openssl rand -hex 32` |
| `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `SEED_ROOT_EMAIL`, `SEED_ROOT_AUTH0_USER_ID` | Tenant de Auth0 (ver "Configurar Auth0" más abajo) |
| `SWAGGER_USER`, `SWAGGER_PASSWORD` | Usuario/contraseña para ver la documentación de la API |

Luego levantar el stack completo (el backend aplica las migraciones automáticamente al arrancar):

```bash
docker compose up -d --build
```

Y **una sola vez**, provisionar el primer acceso de administrador:

```bash
docker compose exec backend npm run seed:root
```

Cuando todo esté arriba, tenés estos servicios:

| Servicio | URL por defecto |
|---|---|
| Panel (frontend) | http://localhost:8080 |
| API (backend) | http://localhost:3000/api/v1 |
| Documentación de la API (Swagger) | http://localhost:3000/api/docs — protegido con HTTP Basic Auth (`SWAGGER_USER` / `SWAGGER_PASSWORD`) |
| Health check | http://localhost:3000/api/v1/health |
| pgAdmin (solo desarrollo local) | http://localhost:5050 — requiere `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD` en `.env` |
| PostgreSQL | localhost:55432 (fuera del contenedor) / postgres:5432 (dentro de la red) |
| Redis | localhost:56379 (fuera del contenedor) / redis:6379 (dentro de la red) |

**Primeros pasos dentro del panel:**
1. **Configuración → Conexión con el proveedor**: servidor, puerto, usuario y token de SENSA.
   Probar la conexión antes de guardar (el test corre del lado del servidor, nunca se expone el token).
2. **Planes comerciales**: cargar los precios reales (el seed los deja en 0).
3. **Empresas Revendedoras**: dar de alta la primera; el sistema genera su invitación de acceso.

---

## Configurar Auth0 (paso previo al primer login)

El sistema autentica con Auth0. Necesitás un tenant propio y dos aplicaciones:

1. **Tenant**: crealo en auth0.com (ej. `iptvcontrol.us.auth0.com`).
2. **Application tipo *Single Page Application* (SPA)** — es la que usa el frontend:
   - Callback URLs: `http://localhost:8080, http://localhost:5173`
   - Logout URLs: `http://localhost:8080, http://localhost:5173`
   - Allowed Origins (CORS): `http://localhost:8080, http://localhost:5173`
   - Su `Client ID` va en `VITE_AUTH0_CLIENT_ID`.
3. **Application tipo *Machine to Machine*** — la usa el backend para la Management API
   (crear usuarios e invitaciones de Team Members):
   - Sus credenciales van en `AUTH0_MGMT_CLIENT_ID` / `AUTH0_MGMT_CLIENT_SECRET`.
4. **API (Resource Server)**: crear una API con Identifier `https://api.iptvcontrol.com.ar`
   (RS256). En *Application Access* hay que **autorizar la SPA** contra esa API, si no, Auth0
   rechaza el token.
5. Crear un usuario en Auth0 (sección *User Management*) con el correo de `SEED_ROOT_EMAIL`
   (ej. `leo@...`), copiar su `user_id` (formato `auth0|...`) a `SEED_ROOT_AUTH0_USER_ID` y correr
   `npm run seed:root` como se indicó arriba. Ese usuario queda habilitado como administrador.

> El "arranque en frío" es un tema conocido y está documentado:
> el primer `operator_admin` **no puede crearse desde el panel** (nadie tiene permisos todavía), por
> eso se provisiona por seed. Ver `docs/04_Esqueleto_Tecnico_Inicial.md`, sección 4.6.

---

## Comandos habituales

Ejecutables desde la **raíz** del repo (con Docker) o dentro de cada carpeta (con Node instalado):

| Qué | Dónde | Comando |
|---|---|---|
| Tests | `backend/` y `frontend/` | `npm test` |
| Typecheck | ambos | `npm run typecheck` |
| Lint | ambos | `npm run lint` |
| Build | ambos | `npm run build` |
| Migraciones | `backend/` | `npm run prisma:migrate` |
| Seed del primer admin | `backend/` | `npm run seed:root` |
| Levantar todo | raíz | `docker compose up -d --build` |
| Ver logs | raíz | `docker compose logs -f backend` |
| Regenerar el knowledge graph | raíz | `graphify update .` |

---

## Variables de entorno

Todas están documentadas en `.env.example`. Las más importantes:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL del **usuario de aplicación** (`iptvcontrol_app`) — NO es owner, para que RLS aplique |
| `DATABASE_URL_MIGRATIONS` | URL del **owner** del schema, usada solo para migraciones |
| `ENCRYPTION_MASTER_KEY` | Clave maestra AES-256-GCM (32 bytes hex). **Nunca** versionar |
| `AUTH0_*` / `VITE_AUTH0_*` | Configuración del tenant de Auth0 |
| `SEED_ROOT_EMAIL`, `SEED_ROOT_AUTH0_USER_ID` | Primer Team Member root del Operador Principal |
| `SENSA_RATE_LIMIT_PER_MINUTE`, `SENSA_REQUEST_TIMEOUT_MS`, `SENSA_DNI_MAX_RETRIES` | Tuning de la integración con SENSA |
| `SWAGGER_USER`, `SWAGGER_PASSWORD` | Protección del Swagger con HTTP Basic Auth |
| `PGADMIN_*` | Credenciales de la interfaz de pgAdmin (solo desarrollo local) |

**Regla de seguridad:** el `.env` está en `.gitignore`. La clave maestra de encriptación y las
credenciales reales de SENSA viven fuera del repo (secretos del VPS).

---

## Desarrollo sin Docker

Requisitos: Node.js 22, PostgreSQL y Redis corriendo localmente.

```bash
# Backend
cd backend
npm install
npx prisma generate
npm run prisma:migrate:dev        # crea la base de datos y aplica migraciones
npm run seed:root                 # primer Team Member root
npm run start:dev                 # http://localhost:3000

# Frontend
cd frontend
npm install
npm run dev                       # http://localhost:5173 (proxea /api al backend)
```

> Con Docker, **solo se usa el `.env` de la raíz** — los `.env` de `backend/` y `frontend/` no se
> leen dentro de los contenedores. Si corrés los procesos localmente (`start:dev`), sí hace falta
> que las variables estén disponibles en el entorno.

---

## Aislamiento multi-tenant: cómo está garantizado

El aislamiento entre Empresas Revendedoras tiene **dos capas** de defensa:

1. **Scope por sesión (aplicación):** un middleware de NestJS ejecuta `SET app.current_tenant`
   por request, según el token de sesión (Team Member). Cada endpoint filtra por ese tenant.
2. **Row-Level Security (base de datos):** políticas en Postgres que aplican el contexto de tenant
   en cada `SELECT`/`INSERT`/`UPDATE`/`DELETE`, incluso si alguien se conectara directamente a la
   base. El usuario de aplicación (`iptvcontrol_app`) **no es owner**, por eso las políticas
   realmente aplican — el owner es `iptvcontrol`, usado solo para migraciones.

**Prueba manual del aislamiento** (conectándose con el usuario de aplicación):

```bash
docker compose exec -T -e PGPASSWORD=<APP_DB_PASSWORD> postgres \
  psql -U iptvcontrol_app -d iptvcontrol -h 127.0.0.1 \
  < backend/prisma/verificar-rls.sql
```

Comprueba que cada tenant vea solo sus filas, que sin contexto no vea nada, y que no pueda escribir
en el tenant de otro.

**Normativa de visibilidad:** el Operador Principal NUNCA ve datos sensibles de las Empresas
Revendedoras (nombres de clientes, contraseñas, notas). Solo puede identificarlas por ID técnico.
La tabla de campos permitidos/prohibidos de `docs/03_Reglas_de_Negocio.md` §4.2 es normativa.

---

## Convenciones de código (léelo antes de tocar algo)

1. **Español en backend, inglés en frontend.** El modelo de datos, la lógica y la documentación
   usan el glosario oficial (`Cuenta`, `Dispositivo`, `Cliente Final`). Las **rutas y componentes**
   del frontend usan inglés genérico (`/accounts`, `/devices`, `CustomerForm`). El cruce vive
   SOLO en `frontend/src/i18n/entityLabels.ts`.
2. **Nunca hablarle directo a SENSA.** Toda integración pasa por `ProveedorAdapter`
   (`backend/src/proveedor/`). Es lo que permite sumar otro proveedor sin tocar el núcleo.
3. **La unidad oficial es Dispositivo.** Para capacidad libre se usa *cupo*.
4. **Casos de uso en servicios, no en controllers.** Así, la API pública de fase 2 es solo agregar
   controllers nuevos sobre los mismos servicios.
5. **Lo que el Operador Principal no puede ver, no se serializa** (no es un tema de ocultarlo en el
   frontend).
6. **Frontend:** rutas en inglés kebab-case, plural, nesting máximo de 1 nivel; filtros como query
   params (`/devices?account_id=456`), nunca como segmentos de URL.
7. **Encriptar todo dato sensible** con el servicio de crypto del backend (AES-256-GCM). Nada de
   credenciales en texto plano.

El detalle completo está en `AGENTS.md` y `docs/IPTVControl_URL_Routing_Convention.md`.

---

## Testing

```bash
# Backend (tests unitarios con Jest)
cd backend && npm test           # ~85 tests: crypto, identificadores SENSA, SensaAdapter, cuentas, clientes…

# Frontend (Vitest)
cd frontend && npm test
```

Para una cobertura mayor hay `npm run test:cov` en el backend. La prioridad del proyecto es la
velocidad de entrega; el testing automatizado no es exhaustivo y las pruebas de integración con
SENSA se hacen contra producción de SENSA (cuentas de Tecnología Activa).

---

## Documentación

- **`AGENTS.md`** — resumen ejecutivo del proyecto y reglas para trabajar con opencode.
- **`docs/`** — documentación normativa (fuente de verdad):
  - `01_Instrucciones_del_Proyecto.md` — alcance del MVP, equipo, infraestructura.
  - `02_Glosario_de_Actores_y_Entidades.md` — nomenclatura oficial.
  - `03_Reglas_de_Negocio.md` — modalidades, ciclo de vida, multi-tenant, auditoría.
  - `04_Esqueleto_Tecnico_Inicial.md` — modelo de datos, patrón `ProveedorAdapter`, flujos.
  - `05_Decisiones_Pendientes.md` — todo lo que **todavía no está cerrado**: no asumir resoluciones.
  - `API_Sensa_V4_1_3.pdf` — documentación oficial de la API de SENSA.
- **`vault/`** — los mismos conceptos con diagramas Mermaid (abrir como vault de Obsidian).
- **`graphify-out/`** — knowledge graph del repo, memoria entre sesiones de opencode.

---

## Preguntas frecuentes (solución de problemas)

| Problema | Solución |
|---|---|
| `docker compose up -d pgadmin` falla | Faltan `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD` en `.env` — cargarlas. |
| "Client ... is not authorized to access resource server" | Autorizar la aplicación SPA en la API de Auth0 (Application Access → Grant Access). |
| Login OK en Auth0 pero el panel da error en `/team-members/me` | El email con el que se loguea no está vinculado a un `TeamMember` activo. Hacer el seed o vincular el `auth0_user_id`. |
| Error `Cannot read properties of undefined (reading 'findUnique')` con Prisma | Bug conocido del getter `sinContexto` con `$extends` de Prisma 6 — ya corregido en `prisma.service.ts`, reconstruir con `docker compose up -d --build backend`. |
| El backend no levanta y algo de migraciones falla | Revisar `DATABASE_URL_MIGRATIONS` (owner). El entrypoint del backend corre las migraciones al arrancar. |

---

## Acerca de

**TECNOLOGIA ACTIVA S.A.S.** — CUIT 30-71600922-6 — Responsable Inscripto —
Echeverría 1776 PB, Godoy Cruz, Mendoza — bruno.c@tecnologiaactiva.com.ar — 261-575-5355 —
tecnologiaactiva.com.ar

Repositorio: [github.com/Leonel-18/iptvcontrol](https://github.com/Leonel-18/iptvcontrol)

Licencia de uso: interna de Tecnología Activa (no publicada).
