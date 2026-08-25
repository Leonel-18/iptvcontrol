# IPTVControl — Contexto para la implementación en producción (Cloudflare + Oracle)

> Documento de **contexto y transferencia** para una IA que va a colaborar en el despliegue en
> producción de IPTVControl sobre **Cloudflare** (DNS/CDN/proxy) e **Oracle Cloud Infrastructure**
> (VPS). Describe **qué existe hoy** (estado real del código y la infraestructura local), qué
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
- **Estado actual:** el MVP funciona **localmente con Docker Compose** (stack completo arriba:
  Postgres + Redis + backend + frontend). Login con Auth0 funcionando con `leomovio5@gmail.com`
  (`operator_admin`, vinculado). `bruno.c@tecnologiaactiva.com.ar` sigue sin vincular (estado
  invitado). Los **85 tests** del backend pasan.
- **Base de datos:** existen tres migraciones de Prisma aplicadas (`20260814120000_init`,
  `20260814120100_rls_multitenant`, `20260814120200_rls_team_member_operador`).
- **Repositorio:** `github.com/Leonel-18/iptvcontrol` (rama `main`).

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

---

## 3. Variables de entorno

Definidas en `.env.example` (plantilla versionada). El `.env` real **no se versiona**. Las que
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

### 4.1. Primer despliegue en Verde (VM nueva)

1. Instalar Docker Engine + Docker Compose en la VM de Oracle.
2. Traer el repo (o imagen buildada) + `.env` con valores de producción.
3. `docker compose up -d --build`.
4. Una sola vez, provisionar el primer Team Member root (arranque en frío):
   `docker compose exec backend npm run seed:root`.
   - Si la base es nueva y no hay datos, el email del root ya debe estar creado en Auth0 y su
     `auth0_user_id` en `SEED_ROOT_AUTH0_USER_ID` (formato `auth0|...`).

### 4.2. Actualización de código

1. `git pull` en la VM.
2. `docker compose up -d --build backend frontend` (el entrypoint corre migraciones nuevas al
   arrancar). En el caso de no cambiar código en el backend, `docker compose up -d` solo.
3. En el caso de modificar `VITE_AUTH0_*` o `VITE_API_BASE_URL` → reconstruir frontend (build-time).

### 4.3. Cambio de datos de conexión SENSA / planes / modalidades

Nada de deploy de código: se hace desde el panel (**Configuración → Conexión con el proveedor** y
**Planes comerciales**). No asumir endpoints todavía cerrados (§7, `docs/05` sección 6).

---

## 5. Definición de la infraestructura objetivo (Cloudflare + Oracle)

### 5.1. Dominio y DNS

- Dominio ya decidido: **`iptvcontrol.com.ar`** (registrado a nombre de Tecnología Activa).
- **Cloudflare** como DNS autoritativo y proxy del dominio: registrar el dominio en Cloudflare y
  apuntar los nameservers hacia Cloudflare en el registrador.
- Subdominios (esquema a confirmar con Bruno/Federico; hoy el código asume el panel en
  `APP_PUBLIC_URL`, y `.env.example` sugiere `https://panel.iptvcontrol.com.ar`):
  - `panel.iptvcontrol.com.ar` (o `iptvcontrol.com.ar` directo) → panel frontend.
  - la API va por el mismo origen vía proxy de nginx (`/api/`), no requiere subdominio propio.
  - No exponer Swagger por una URL pública sin auth HTTP Basic.

### 5.2. Cloudflare (configuración sugerida, a validar)

- **Proxy (naranja)** activo para el A record del panel → esconde la IP real del VPS y permite
  reglas WAF/rate-limiting.
- **SSL/TLS mode:** **Full (strict)** con certificado de origen de Cloudflare Origin CA instalado
  en nginx de la VM (origen habla HTTPS; Cloudflare termina el TLS hacia el navegador). Alternativa
  mínima (menos segura): Full sin strict. Decisión a validar.
- **Always Use HTTPS** activo, HTTP/2/3 habilitados.
- WAF y reglas de rate limiting opcionales (login de Auth0 ocurre en el tenant de Auth0, no en
  nuestro origen; proteger las rutas `/api/*`).
- Caché: solo assets estáticos del frontend (los hashes lo permiten); **nunca cachear `/api/*`**.

### 5.3. Oracle Cloud Infrastructure (OCI)

- VM sugerida: shape **Ampere A1 (ARM)** del Always Free tier (4 OCPU / 24 GB RAM) — suficiente
  para la escala esperada (~10 Empresas Revendedoras, ~9.000 Clientes Finales, ~1.500 Cuentas);
  alternativa pagada AMD con ≥4 vCPU / 8 GB RAM. Docker en ARM: las imágenes base
  (`node:22-alpine`, `postgres:16-alpine`, `redis:7-alpine`, `nginx:1.27-alpine`) tienen variantes
  arm64. Verificación previa: probar el arranque de todas las imágenes en la VM (las que hoy corren
  en dev solo se probaron en x86).
- **Red/seguridad en OCI (Security Lists / NSG):** solo exponer
  - `22/tcp` (SSH, restringido a IPs de Tecnología Activa),
  - `80/tcp` y `443/tcp` para el panel (idealmente permitir únicamente los rangos de IP de
    Cloudflare, ver Cloudflare IP ranges, para que nadie llegue directo al origen sin pasar por el
    proxy).
- **NO exponer** los puertos de `backend:3000`, `postgres:5432/55432`, `redis:6379/56379` al
  exterior: dejar esas publicaciones de puerto fuera del compose de producción (red interna de
  Docker es suficiente). El compose local actual publica puertos para desarrollo: ajustar un
  `docker-compose.prod.yml` que los elimine (solo `80/443` en nginx).
- **Persistencia:** usar los named volumes de Docker en disco de la VM; backups los gestiona
  infraestructura de Tecnología Activa (fuera del alcance de este proyecto — no implementar
  nada de backups acá, solo documentar cómo quedaría el mapa de volúmenes).
- **Ambiente:** producción controlada directamente, sin staging. Pruebas contra SENSA se hacen
  contra la producción de SENSA.

### 5.4. HTTPS y TLS en origen

- nginx actual escucha solo `80`. En producción (con Cloudflare Full strict) instalar cert de
  origen en nginx y habilitar `443`. Con la variante de Cloudflare Full (sin strict) se puede
  dejar el origen en `80`, pero es la opción menos recomendable.
- Si el panel terminara alojado **fuera de Cloudflare** en algún caso, usar Let's Encrypt
  (certbot) — pero el objetivo declarado es Cloudflare delante, por lo que Origin CA es lo natural.

---

## 6. Manejo de secretos en producción

- Clave maestra AES (`ENCRYPTION_MASTER_KEY`), credenciales de SENSA (`user`/`token`), credenciales
  de la M2M de Auth0 y contraseñas de BDD **NUNCA en el repo** (`.gitignore` excluye `.env`).
- Método propuesto para la VM: archivo `.env` en la VM con permisos `600` (fuera del repo) o un
  gestor de secretos. Se deja la elección del mecanismo a la IA/equipo — NO se asume ninguno
  todavía.
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

- [ ] Dominio en Cloudflare (nameservers), A record proxied a la IP pública del VPS.
- [ ] VM en OCI con Docker; reglas de seguridad aplicadas (SSH restringido, solo 80/443 con
      rangos de Cloudflare; puertos internos cerrados).
- [ ] `docker-compose.override.yml` o `docker-compose.prod.yml` que quite las publicaciones de
      puertos de postgres/redis/backend y deje solo nginx 80/443 (+ pgadmin fuera).
- [ ] `.env` de producción completo (secretos generados, `.env.example` como guía).
- [ ] Certificado de origen (Cloudflare Origin CA o cero si se elige Full) en nginx.
- [ ] Auth0: agregar las URLs de callback/logout de producción a la SPA (hoy solo apuntan a
      localhost). Verificar audience.
- [ ] Arrancar, validar healthcheck (`.api/v1/health`) y hacer `seed:root` una sola vez.
- [ ] Login real de punta a punta contra Auth0 en el dominio de producción.
- [ ] Probar alta de Empresa Revendedora / invitación (email), modalidad y planes desde el panel.
- [ ] Backup de volúmenes (Postgres + Redis) documentado para infraestructura.
- [ ] Actualizar `docs/` y `graphify update .` cuando cierre decisiones.

---

## 9. Cómo usar este documento

- **Para la IA de despliegue:** leerlo junto con `AGENTS.md`, `docs/05_Decisiones_Pendientes.md` y
  `.env.example`. No inventar valores secretos; pedirlos o marcarlos como "por cargar".
- **Regla de oro:** cualquier dúbito entre lo que este documento dice y `docs/05_Decisiones_
  Pendientes.md` → lo de pendientes manda (nada está "resuelto" si figura ahí).
- **Después de cambios de código/infra relevantes:** correr `graphify update .` y actualizar este
  documento si cambió alguna decisión.
