# IPTVControl — Despliegue en producción sobre VPS Ubuntu

> Documento operativo para desplegar IPTVControl sobre una **VPS Ubuntu 24.04 LTS AMD64** con
> Docker Compose y HTTPS administrado por Caddy. Describe **qué existe hoy**, qué
> restricciones impone el diseño (RLS, encriptación, Auth0) y qué decisiones siguen abiertas.
> Cuando este documento y `docs/05_Decisiones_Pendientes.md` difieran en algo, manda el de
> pendientes como "no decidido".
>
> Normativa general: `AGENTS.md` + `docs/` (fuente de verdad). El uso de este documento es
> **operativo**: describe la infraestructura actual y las consideraciones para el paso a
> producción, sin reemplazar las reglas de negocio de `docs/03_Reglas_de_Negocio.md`.

---

## 1. ¿Qué es IPTVControl y en qué estado está?

Plataforma **multi-tenant** de gestión de reventa de cuentas IPTV (sobre **SENSA**), que automatiza
el ciclo de vida de **Cuentas / Dispositivos / Clientes Finales** entre un **Operador Principal**
(Tecnología Activa) y sus **Empresas Revendedoras**.

- **Glosario** (nombres obligatorios en base y lógica): `docs/02_Glosario_de_Actores_y_Entidades.md`.
  La unidad oficial es **Dispositivo**; para capacidad libre se usa **cupo**.
- **Estado actual:** el MVP funciona localmente con Docker Compose (Postgres + Redis + backend +
  frontend). La suite vigente tiene **119 tests de backend y 23 de frontend**.
- **Producción confirmada (26/08/2026):** VPS propia con Ubuntu 24.04 LTS, arquitectura AMD64,
  dominio `iptvcontrol.com.ar` administrado y proxied por Cloudflare, base PostgreSQL nueva y
  HTTPS en origen con Caddy + Let's Encrypt.
- **Administradores iniciales:** Bruno es el primer `operator_admin` creado por el seed. Después
  de ingresar, invita a Leonel como segundo `operator_admin` desde `/team-members`.
- **Repositorio:** `github.com/Leonel-18/iptvcontrol`; producción se despliega desde `main`.

---

## 2. Stack y topología actuales (Docker Compose local)

| Servicio | Imagen / build | Puerto | Rol |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `localhost:55432` (host) / `5432` (red interna) | Base de datos con **Row-Level Security** |
| `redis` | `redis:7-alpine` | `localhost:56379` / `6379` | BullMQ (reintentos contra SENSA) |
| `pgadmin` | `dpage/pgadmin4` | `127.0.0.1:5050` | **Solo desarrollo local** — no sale a producción |
| `backend` | Dockerfile propio (NestJS) | `localhost:3000` | API `/api/v1`, Swagger en `/api/docs`, healthcheck en `/api/v1/health` |
| `frontend` | Vite → `nginx:1.27-alpine` | `localhost:8080` → port 80 interno | Panel; nginx **proxea `/api/` al backend** (mismo origen, sin CORS) |

Flujo HTTP por defecto local: navegador → `nginx` (frontend, puerto 80) → `http://backend:3000`
para `/api/`. Los assets estáticos llevan hash y se cachean 1 año en `frontend/nginx.conf`.

**Detalles que importan para producción** (ya implementados en el código):

1. **Migraciones al arrancar:** el entrypoint `backend/docker-entrypoint.sh` corre
   `prisma migrate deploy` con `DATABASE_URL_MIGRATIONS` (usuario **owner** del schema). El runtime
   usa `DATABASE_URL` con el usuario **de aplicación** (`iptvcontrol_app`, `NOBYPASSRLS`).
   Consecuencia: **no se puede correr más de una réplica del backend** que inicie al mismo tiempo
   sin coordinar migraciones (misma regla que BullMQ de un solo worker).
2. **RLS en dos capas:** middleware NestJS hace `SET app.current_tenant` por request + políticas
   RLS en Postgres. El usuario de aplicación no es owner, para que las políticas apliquen de
   verdad (script `docker/postgres/init/01-app-user.sh`, se ejecuta SOLO en la primera creación del
   volumen).
3. **Encriptación AES-256-GCM** (`ENCRYPTION_MASTER_KEY`, 32 bytes hex) para credenciales de
   Cuentas SENSA. **Si volcamos datos de un ambiente con datos a otro, se debe usar la misma clave**
   o reencriptar; cambiar la clave invalida lo encriptado.
4. **VITE_* se resuelven en tiempo de build** del frontend (Vite las incrusta en el bundle).
   Cambiar dominio/Client ID de Auth0 o la URL base implica **reconstruir la imagen** del frontend
   (`frontend/Dockerfile`). `VITE_API_BASE_URL` por defecto es `/api/v1` (mismo origen vía nginx).
5. **Swagger protegido** con HTTP Basic Auth (`SWAGGER_USER`/`SWAGGER_PASSWORD`). Si quedan vacías,
   Swagger no se expone.

La definición de producción es `docker-compose.prod.yml` y se ejecuta de manera independiente del
Compose local. No incluye pgAdmin ni publica puertos de PostgreSQL, Redis, backend o frontend. El
único servicio expuesto es Caddy en `80/443`; Caddy envía `/api/*` al backend y el resto al frontend.

---

## 3. Variables de entorno

La plantilla de producción es `.env.production.example`. En la VPS se copia como
`.env.production`; el archivo real **no se versiona**. Las que
necesitan **sí o sí** definirse en producción:

| Variable | Notas para producción |
|---|---|
| `NODE_ENV=production`, `PORT=3000` | Ya fijados por el compose |
| `APP_PUBLIC_URL` | **Debe ser el dominio público del panel** (usada para links de invitación de Team Members) |
| `CORS_ORIGINS` | Orígenes permitidos; con el proxy de nginx de mismo origen casi no aplica, pero configurarla igual al dominio real |
| `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `DATABASE_URL`, `DATABASE_URL_MIGRATIONS` | Claves nuevas de la VM (no reutilizar las de desarrollo) |
| `REDIS_PASSWORD` | **Definir en producción** (red no confiable solo por red interna Docker, sí conviene) |
| `ENCRYPTION_MASTER_KEY` | `openssl rand -hex 32`. Guardarla como secreto (ver §6). **Ojo con migraciones de datos** (§2.3) |
| `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_ISSUER_URL` | Ya reales: `iptvcontrol.us.auth0.com`, `https://api.iptvcontrol.com.ar` |
| `AUTH0_MGMT_CLIENT_ID/SECRET` | Application M2M `IPTVControl Backend Management` (para invitaciones de Team Members) |
| `AUTH0_DB_CONNECTION`, `AUTH0_INVITATION_TTL_SEC` | Con su valor por defecto |
| `SWAGGER_USER` / `SWAGGER_PASSWORD` | Definir para que `/api/docs` esté disponible |
| `SENSA_*` | Rate limit/timeout/`SENSA_DNI_MAX_RETRIES` ya parametrizados |
| `SEED_ROOT_EMAIL`, `SEED_ROOT_AUTH0_USER_ID` | Ya usados; en prod el seed se corre UNA vez (ver §4.1) |
| `VITE_API_BASE_URL`, `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE` | Build args del frontend (tiempo de build) |
| `PGADMIN_*` | **Solo dev**; no habilitar en producción |

Valores de referencia actuales (Auth0, públicos y ya usados): Client ID de la SPA `iptvcontrol`
= `krKcEy1OR8Ar1UaXn9K1oYdGl7I50byc`; M2M `IPTVControl Backend Management` =
`WDQt3g4KAj6K1ubZwcwdU29Z0jVzqgh9` (client ID — el **secret** NO va a este documento ni al repo).

---

## 4. Procedimientos de arranque / mantenimiento

### 4.1. Primer despliegue en una VPS nueva

1. Instalar Docker Engine + Docker Compose en Ubuntu 24.04.
2. Clonar `main` y crear `.env.production` a partir de `.env.production.example`.
3. Dar permisos al archivo: `chmod 600 .env.production`.
4. Arrancar con
   `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build`.
5. Una sola vez, provisionar el primer Team Member root (arranque en frío):
   `docker compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run seed:root`.
   Si `SEED_ROOT_AUTH0_USER_ID` queda vacío, el seed usa la Management API para crear o encontrar
   a Bruno, completar sus metadatos y mostrar un link de un solo uso para definir la contraseña.
6. Bruno inicia sesión e invita a Leonel como `operator_admin` desde `/team-members`.

### 4.2. Actualización de código

1. `git pull --ff-only origin main` en la VPS.
2. `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build` (el
   entrypoint aplica las migraciones nuevas antes de arrancar el backend).
3. En el caso de modificar `VITE_AUTH0_*` o `VITE_API_BASE_URL` → reconstruir frontend (build-time).

### 4.3. Cambio de datos de conexión SENSA / planes / modalidades

Nada de deploy de código: se hace desde el panel (**Configuración → Conexión con el proveedor** y
**Planes comerciales**). No asumir endpoints todavía cerrados (§7, `docs/05` sección 6).

---

## 5. Infraestructura de producción confirmada

### 5.1. Dominio, DNS y HTTPS

- Dominio público: **`iptvcontrol.com.ar`**.
- Los nameservers ya delegan en Cloudflare (`dorthy.ns.cloudflare.com` y
  `thomas.ns.cloudflare.com`) y el proxy naranja está activo.
- El registro `A` de `@` debe apuntar a la IP pública de la VPS. Para la primera emisión del
  certificado conviene dejarlo temporalmente en **DNS only**, levantar Caddy y comprobar HTTPS;
  después se vuelve a activar **Proxied**.
- Caddy escucha en `80/443`, solicita y renueva automáticamente un certificado público de Let's
  Encrypt. Cloudflare debe usar **SSL/TLS = Full (strict)**; no hace falta instalar un Origin CA.
- En Cloudflare se activa **Always Use HTTPS** y se crea una regla de caché para omitir `/api/*`.
- La API usa el mismo dominio bajo `/api`; no requiere un subdominio público.

### 5.2. VPS y firewall

- Sistema confirmado: Ubuntu 24.04.1 LTS, arquitectura AMD64/x86_64.
- Exponer únicamente `22/tcp`, `80/tcp`, `443/tcp` y `443/udp` (HTTP/3 opcional).
- Restringir SSH a las IP autorizadas siempre que sean estables.
- Después de comprobar el proxy puede restringirse `80/443` a los rangos oficiales de Cloudflare,
  manteniendo actualizada esa lista. No hacerlo antes de emitir y probar el certificado.
- PostgreSQL, Redis, backend y frontend no publican puertos en `docker-compose.prod.yml`.
- Los datos persisten en los volúmenes `postgres_data`, `redis_data`, `caddy_data` y
  `caddy_config`. Los backups de infraestructura deben incluir PostgreSQL y los secretos externos.

---

## 6. Manejo de secretos en producción

- Clave maestra AES (`ENCRYPTION_MASTER_KEY`), credenciales de SENSA (`user`/`token`), credenciales
  de la M2M de Auth0 y contraseñas de BDD **NUNCA en el repo** (`.gitignore` excluye `.env`).
- Método definido para la VPS: archivo `.env.production` con permisos `600` (fuera del repo).
  Además debe existir una copia segura de sus secretos críticos fuera de la VPS.
- Token de SENSA además viaja cifrado en la base (AES-256-GCM) y el test de conexión del panel se
  ejecuta server-side (nunca en el navegador).

---

## 7. Pendientes que afectan el despliegue (no asumir como resueltos)

Ver el detalle completo en `docs/05_Decisiones_Pendientes.md`. Los que impactan producción:

- **Mecanismo de provisioning del primer Team Member root** (seed manual `npm run seed:root` vs.
  seed automático al primer `docker compose up`): hoy el código implementa **la variante manual**.
- **Invitación de Team Members no-root**: se usa M2M + Password Change Tickets de Auth0; **quién
  manda el email de invitación** (backend con servicio de mail propio vs. plantilla de Auth0),
  `ttl` del link y **reenvío** siguen sin definir → el composable de email puede fallar en prod
  hasta cerrarlo.
- **Resguardo de contraseña/PIN de Cuenta** en las vistas del panel (control de accesos/registro)
  → pendiente, puede requerir cambios en frontend/backend.
- **Umbral de la alerta de Cuenta cerca del tope** (2 de 3 es un valor inicial, no configurado).
- **Límite de reintentos de DNI** (`SENSA_DNI_MAX_RETRIES` está parametrizado, pero el
  comportamiento ante el tope no está definido).
- **Formato de CUIT** de Empresa Revendedora (validación).
- **Endpoints del Menú de Parametrización SENSA** (son placeholder).
- **Modelo de licenciamiento** (no bloquea despliegue).

---

## 8. Checklist de puesta en producción (borrador para validar con la IA)

- [x] Nameservers de `iptvcontrol.com.ar` delegados en Cloudflare.
- [ ] Registro DNS `A` de `iptvcontrol.com.ar` apuntando a la IP pública correcta de la VPS.
- [ ] Cloudflare en DNS only durante el primer certificado; después Proxied + Full (strict).
- [ ] Always Use HTTPS activo y caché omitida para `/api/*`.
- [ ] VPS Ubuntu 24.04 con Docker y firewall; sólo SSH, 80 y 443 públicos.
- [x] `docker-compose.prod.yml` sin pgAdmin ni puertos internos publicados.
- [ ] `.env.production` completo y con permisos `600`.
- [ ] Caddy obtiene un certificado válido de Let's Encrypt.
- [ ] Auth0: agregar las URLs de callback/logout de producción a la SPA (hoy solo apuntan a
      localhost). Verificar audience.
- [ ] Arrancar, validar `/api/v1/health` y hacer `seed:root` una sola vez para Bruno.
- [ ] Invitar a Leonel como segundo `operator_admin` desde `/team-members`.
- [ ] Login real de punta a punta contra Auth0 en el dominio de producción.
- [ ] Probar alta de Empresa Revendedora / invitación (email), modalidad y planes desde el panel.
- [ ] Backup de volúmenes (Postgres + Redis) documentado para infraestructura.
- [ ] Actualizar `docs/` y `graphify update .` cuando cierre decisiones.

---

## 9. Cómo usar este documento

- **Para la IA de despliegue:** leerlo junto con `AGENTS.md`, `docs/05_Decisiones_Pendientes.md` y
  `.env.production.example`. No inventar valores secretos; pedirlos o marcarlos como "por cargar".
- **Regla de oro:** cualquier dúbito entre lo que este documento dice y `docs/05_Decisiones_
  Pendientes.md` → lo de pendientes manda (nada está "resuelto" si figura ahí).
- **Después de cambios de código/infra relevantes:** correr `graphify update .` y actualizar este
  documento si cambió alguna decisión.
