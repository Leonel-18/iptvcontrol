# IPTVControl — Guía de integración para el Portal de Cliente

> Documento dirigido al equipo/IA que construye y mantiene el **portal externo del Cliente Final**.
> Describe cómo integrarse con IPTVControl para que un Cliente Final consulte su servicio y, en
> cuentas exclusivas, lo administre. Reutiliza la misma lógica de negocio, aislamiento multi-tenant
> e integración con el Proveedor (SENSA) que el panel interno.
>
> Fuentes de verdad generales: `AGENTS.md`, `docs/03_Reglas_de_Negocio.md`. Este documento es la
> guía operativa de la integración.

---

## 1. Objetivo y alcance

El Portal de Cliente permite que un Cliente Final de **una Empresa Revendedora** (fija, definida en
el servidor) pueda:

1. **Consultar** sus credenciales (`usuario`, `password`, `pin`), sus **servicios** y sus
   **dispositivos**.
2. En **cuentas exclusivas**, **administrar** su servicio: cambiar contraseña, PIN y servicios, y
   gestionar sus dispositivos (asignar los detectados en el Proveedor y dar de baja los propios).

En **cuentas compartidas** (más de un Cliente Final), el portal es **solo lectura**: el Cliente ve
únicamente los dispositivos que la Empresa Revendedora le asignó y **no puede editar nada**.

No existe modo de prueba o `dry-run`. Las operaciones de escritura son **reales**: cambian datos en
IPTVControl y en el Proveedor (SENSA).

---

## 2. Lo que IPTVControl entrega al integrador

Por un canal seguro, se entregan dos valores:

- `BASE_URL`: URL pública de IPTVControl (ej. `https://iptvcontrol.com.ar`).
- `API_KEY`: credencial privada de la integración (equivale a `PORTAL_CLIENTE_API_KEY`).

**Reglas de manejo de la API key (obligatorias):**

- Va **exclusivamente en el servidor del portal** (server-to-server). **Nunca** en el navegador, en
  el bundle de JavaScript, en apps móviles, en repositorios, en capturas ni en logs.
- Con solo el DNI, la API devuelve las **credenciales** del Cliente. Por eso la API key debe
  tratarse como un secreto crítico: quien la tenga puede leer credenciales de cualquier Cliente de
  la Empresa Revendedora.
- El portal es responsable de **autenticar a su propio usuario** antes de llamar a IPTVControl.
  IPTVControl **no** autentica personas: confía en el servidor del portal.

---

## 3. Conceptos de negocio que el integrador debe entender

| Concepto | Qué es |
|---|---|
| Cliente Final | La persona. Se identifica por su **DNI** dentro de la Empresa Revendedora. |
| Cuenta | La unidad de servicio IPTV. Tiene `usuario`, `password` y `pin`. |
| Cuenta **exclusiva** | Un único Cliente Final. El portal permite **editar**. |
| Cuenta **compartida** | Varios Clientes Finales comparten la misma Cuenta y credenciales. El portal es **solo lectura**. |
| Servicios | Paquetes de contenido (códigos). Se validan contra lo contratado por el Operador Principal. |
| Dispositivo | Equipo del Cliente. En SENSA se identifica por `proveedor_device_id`. |
| Incidencia | Dispositivo detectado en el Proveedor **sin dueño asignado** en IPTVControl. El Cliente (cuenta exclusiva) puede reclamarlo. |

**Reglas invariables:**

1. El **usuario** de una Cuenta **nunca** se puede cambiar.
2. Los **servicios** se validan contra lo contratado; no se pueden inventar. El paquete básico se
   agrega siempre.
3. Un Cliente solo puede operar sobre **sus** cuentas. IPTVControl revalida la titularidad en cada
   request; el portal no es la única barrera.
4. La Empresa Revendedora de la integración es **fija** (configurada en el servidor). El portal no
   puede elegir a qué Empresa pertenece un DNI.

---

## 4. Autenticación

Todas las llamadas llevan el header:

```http
x-api-key: <API_KEY>
```

No se usa Auth0 ni token de usuario. La Empresa Revendedora y el "actor" de las acciones se
determinan por configuración del servidor, no por el request.

Errores de autenticación/configuración:

| Situación | HTTP | Cuerpo |
|---|---:|---|
| Falta o es incorrecta la `x-api-key` | `401` | `{ "statusCode": 401, "message": "Credencial de integración inválida." }` |
| La integración no está configurada en el servidor | `503` | `{ "statusCode": 503, "message": "La integración del Portal de Cliente no está configurada en el servidor." }` |

---

## 5. Modelo de errores

A diferencia de la API del bot de WhatsApp (que responde `HTTP 200` con `success: false`), este
portal usa **HTTP estándar**. El integrador debe evaluar el **status code**.

| HTTP | Significado | Acción del portal |
|---:|---|---|
| `200` | OK | Procesar la respuesta |
| `400` | Datos inválidos / combinación no permitida | Corregir el request; mostrar el mensaje |
| `401` | API key inválida/ausente | Error de integración (no del usuario) |
| `403` | Regla de negocio: cuenta compartida, cuenta ajena, cuenta inactiva | Mostrar en modo lectura; no reintentar |
| `404` | DNI o cuenta o dispositivo inexistente | Mostrar "no encontrado" |
| `429` | Rate limit | Esperar y reintentar con backoff |
| `503` | Integración no habilitada o dependencia caída | Reintentar más tarde |
| `500` | Error inesperado | Reintentar; avisar a soporte con fecha/hora |

El cuerpo de error sigue el formato de NestJS:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Esta Cuenta es compartida: el portal sólo permite consultar su información.",
  "path": "/api/v1/integration/portal-cliente/accounts/.../password",
  "timestamp": "2026-10-14T13:59:06.355Z",
  "requestId": "f04d0c80-eb18-4850-bc05-61c2c94276e4"
}
```

---

## 6. Endpoints

Base: `{{BASE_URL}}/api/v1/integration/portal-cliente`

### 6.1. `POST /session` — Sesión del Cliente por DNI

Devuelve el Cliente y **todas** sus cuentas, con credenciales, servicios y dispositivos.

**Request**

```http
POST /api/v1/integration/portal-cliente/session
Content-Type: application/json
x-api-key: <API_KEY>

{ "dni": "30123456" }
```

**Response 200**

```json
{
  "cliente": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "numero_cliente": 1042,
    "nombre_completo": "Juan Pérez",
    "dni": "30123456",
    "estado": "activo"
  },
  "cuentas": [
    {
      "id": "7c97bc26-fdda-4fc8-b42a-397389aa0111",
      "proveedor_cuenta_id": "13000002",
      "es_exclusiva": true,
      "es_prueba": false,
      "prueba_vence_en": null,
      "aislada": false,
      "estado": "activa",
      "usuario": "13000002",
      "password": "12345678",
      "pin": "123456",
      "servicios": "1|2|3|4|5|6|7",
      "servicios_nombres": ["Básico", "..."],
      "puede_editar": true,
      "dispositivos": [
        {
          "id": "b1e0c3...",
          "proveedor_device_id": "40001234",
          "tipo": "fijo",
          "estado": "activo",
          "estado_vinculacion": "vinculado",
          "mac": "03:AC:1A:E6:0C:A7",
          "modelo": "Android TV",
          "ultimo_inicio": "2026-10-10T18:22:00.000Z"
        }
      ]
    }
  ]
}
```

**Campos clave de cada cuenta:**

| Campo | Descripción |
|---|---|
| `es_exclusiva` | `true` = exclusiva, `false` = compartida |
| `puede_editar` | `true` **solo** si es exclusiva, del titular y la cuenta está activa. **El portal debe basarse en este campo para mostrar u ocultar las acciones de edición.** |
| `es_prueba` / `prueba_vence_en` | Si es cuenta de prueba, avisar al usuario que se cierra sola en esa fecha |
| `aislada` | Cuenta compartida que no recibe clientes nuevos temporalmente |
| `servicios` | Cadena de códigos (ej. `"1|3|5"`) para enviar en el cambio de servicios |
| `servicios_nombres` | Nombres legibles de esos códigos |
| `dispositivos` | En **compartida**: solo los asignados a este Cliente. En **exclusiva**: los de la cuenta |

**Errores:** `404` si no hay un Cliente Final con ese DNI. `429` si se supera el límite (30/min).

> **Importante:** en cuentas compartidas los `dispositivos` que devuelve `session` son **solo los
> asignados al Cliente**; no hay endpoint de dispositivos para compartidas.

---

### 6.2. `PATCH /accounts/{cuentaId}/password` — Cambiar contraseña

Solo cuentas exclusivas del titular.

```http
PATCH /api/v1/integration/portal-cliente/accounts/{cuentaId}/password
Content-Type: application/json
x-api-key: <API_KEY>

{ "dni": "30123456", "password": "87654321" }
```

- `password`: numérica, **8 a 20 dígitos**.
- Se aplica en SENSA y en IPTVControl.
- `200` → `{ "id": "<cuentaId>" }`.

---

### 6.3. `PATCH /accounts/{cuentaId}/pin` — Cambiar PIN

Solo cuentas exclusivas del titular.

```http
PATCH /api/v1/integration/portal-cliente/accounts/{cuentaId}/pin
x-api-key: <API_KEY>

{ "dni": "30123456", "pin": "654321" }
```

- `pin`: numérico, **6 dígitos**.
- Se aplica en SENSA y en IPTVControl. `200` → `{ "id": "<cuentaId>" }`.

---

### 6.4. `PATCH /accounts/{cuentaId}/services` — Cambiar servicios

Solo cuentas exclusivas del titular.

```http
PATCH /api/v1/integration/portal-cliente/accounts/{cuentaId}/services
x-api-key: <API_KEY>

{ "dni": "30123456", "servicios": ["1", "3", "5"] }
```

- Se validan contra lo contratado por el Operador Principal. El básico (`"1"`) se agrega siempre.
- `200` → devuelve la Cuenta actualizada (sin credenciales).
- `400` si algún servicio no está contratado.

---

### 6.5. `POST /accounts/{cuentaId}/devices/sync` — Ver dispositivos del Proveedor

Solo cuentas exclusivas del titular. Consulta el inventario real de la Cuenta en SENSA (como el
botón "Consultar dispositivos en el proveedor" del panel).

```http
POST /api/v1/integration/portal-cliente/accounts/{cuentaId}/devices/sync
x-api-key: <API_KEY>

{ "dni": "30123456" }
```

**Response 200 (resumida)**

```json
{
  "cuenta_id": "...",
  "proveedor_cuenta_id": "13000002",
  "limite_dispositivos": 3,
  "sincronizado_en": "2026-10-14T13:00:00.000Z",
  "dispositivos": [
    {
      "proveedor_device_id": "40001234",
      "tipo": "fijo",
      "clasificacion": "vinculado",
      "dispositivo_id": "b1e0c3...",
      "cliente_final": { "id": "...", "numero_cliente": 1042, "nombre": "Juan Pérez" }
    },
    {
      "proveedor_device_id": "40009999",
      "tipo": "movil",
      "clasificacion": "desconocido",
      "incidencia_id": "d4f2...",
      "mac": "AA:BB:CC:DD:EE:FF",
      "modelo": "Celular",
      "ventana_activa": false
    }
  ]
}
```

- `clasificacion: "vinculado"` → el equipo ya tiene dueño (es del Cliente).
- `clasificacion: "desconocido"` + `incidencia_id` → equipo detectado **sin dueño**, reclamable.

---

### 6.6. `POST /accounts/{cuentaId}/devices/claim` — Reclamar un dispositivo

Solo cuentas exclusivas del titular. Asigna al titular un dispositivo detectado sin dueño.

```http
POST /api/v1/integration/portal-cliente/accounts/{cuentaId}/devices/claim
x-api-key: <API_KEY>

{ "dni": "30123456", "proveedor_device_id": "40009999" }
```

- `proveedor_device_id` se obtiene del `sync` (un equipo con `clasificacion: "desconocido"`).
- Si el equipo era parte de una venta reservada, respeta los cupos comerciales.
- `200` → `{ "id": "<incidenciaId>", "estado": "...", "resolucion": "vinculado", "dispositivo_id": "..." }`.
- `404` si no hay una incidencia **pendiente** con ese `proveedor_device_id` (ya fue vinculado o no existe).

---

### 6.7. `POST /accounts/{cuentaId}/devices/{dispositivoId}/remove` — Dar de baja un dispositivo propio

Solo cuentas exclusivas del titular. **IRREVERSIBLE.**

```http
POST /api/v1/integration/portal-cliente/accounts/{cuentaId}/devices/{dispositivoId}/remove
x-api-key: <API_KEY>

{ "dni": "30123456" }
```

- Elimina el Dispositivo en el **Proveedor** y borra la fila local. Queda registrado en el Audit Log.
- **El portal debe mostrar una advertencia explícita de que es irreversible antes de llamar.**
- `200` → `{ "id": "<dispositivoId>" }`.
- `404` si el dispositivo no pertenece a esa Cuenta.
- `400` si el dispositivo está **bloqueado por suspensión** del Cliente.

> `dispositivoId` es el `id` local que aparece en `session` (campo `dispositivos[].id`), **no** el
> `proveedor_device_id`.

---

## 7. Reglas de autorización (doble capa)

El portal debe aplicar **dos capas**:

1. **UX (portal):** según `cuenta.puede_editar` de `session`, mostrar las acciones de edición o el
   modo solo lectura.
2. **Seguridad (IPTVControl):** cada escritura revalida en el servidor. Aunque el portal llame de
   más, IPTVControl responde:
   - `403` "Esta Cuenta es compartida: el portal sólo permite consultar su información."
   - `403` "La Cuenta no pertenece a este Cliente."
   - `403` "La Cuenta no está activa."

Otra verificación de seguridad implícita: si la Empresa Revendedora está **suspendida**, toda la
integración responde `403` (el guard lo detecta).

---

## 8. Flujos recomendados

### 8.1. Lectura (cualquier cuenta)

```
1. Cliente se autentica en el portal (responsabilidad del portal).
2. El portal llama POST /session { dni } con x-api-key.
3. Renderiza cada cuenta:
   - usuario / password / pin / servicios / dispositivos.
   - Si cuenta.puede_editar === false → modo solo lectura.
```

### 8.2. Edición (solo cuentas exclusivas)

```
1. session → detectar cuenta con puede_editar === true.
2. Cambiar contraseña:  PATCH /accounts/{id}/password
   Cambiar PIN:         PATCH /accounts/{id}/pin
   Cambiar servicios:   PATCH /accounts/{id}/services
3. Refrescar con POST /session (o usar la respuesta) para reflejar el cambio.
```

### 8.3. Dispositivos (solo cuentas exclusivas)

```
1. POST /accounts/{id}/devices/sync   → lista de equipos (vinculado / desconocido)
2. Para un "desconocido" con incidencia_id:
      POST /accounts/{id}/devices/claim { proveedor_device_id }
3. Para un dispositivo propio (dispositivos[].id de session):
      POST /accounts/{id}/devices/{dispositivoId}/remove   (ADVERTIR: irreversible)
```

---

## 9. Consideraciones de sensibilidad de datos

- `session` devuelve `password` y `pin`. Son datos sensibles:
  - **No** loguearlos del lado del portal.
  - Entregarlos solo al Cliente titular y solo cuando lo solicite.
  - No cachearlos más de lo necesario.
- El endpoint `session` tiene un **rate limit de 30 solicitaciones por minuto** (además del límite
  global de la API). Respetar `429` con backoff.
- No escribir la API key en frontend, repositorios, capturas ni logs.

---

## 10. Checklist del integrador

- [ ] Guardar `BASE_URL` y `API_KEY` como secretos del **servidor** del portal.
- [ ] Enviar `Content-Type: application/json` y `x-api-key` en todas las requests.
- [ ] Basar la UI en `cuenta.puede_editar` (exclusiva ⇒ editable; compartida ⇒ solo lectura).
- [ ] Evaluar el **status code** (no un campo `success`).
- [ ] Advertir al usuario antes de **dar de baja** un dispositivo (irreversible).
- [ ] Avisar cuando la cuenta es **de prueba** (`es_prueba`) y su `prueba_vence_en`.
- [ ] Avisar cuando la cuenta está **aislada** (`aislada`).
- [ ] No loguear `password`, `pin` ni la API key.
- [ ] Respetar `429` y `503` con reintentos y backoff.
- [ ] Validar el DNI del Cliente según las reglas propias del portal antes de llamar a `session`.

---

## 11. Postman

La colección `docs/postman/IPTVControl_PortalCliente.postman_collection.json` usa variables
(`baseUrl`, `apiKey`, `dni`, `cuentaId`, `dispositivoId`, `proveedorDeviceId`) y no contiene datos
reales. Orden sugerido: **Sesión → Sync → Claim → Remove**. El script de `sync` completa
automáticamente `proveedorDeviceId` con el primer equipo desconocido.

---

## 12. Preguntas frecuentes / límites conocidos

- **¿Puedo consultar por DNI a un cliente de otra Empresa Revendedora?** No. La empresa está fija
  en la configuración del servidor; el DNI se busca solo dentro de esa Empresa.
- **¿El DNI alcanza como seguridad?** No por sí solo. La seguridad la da la API key server-to-server
  y el hecho de que el portal autentica a su usuario antes. Tratar la API key como secreto crítico.
- **¿Puedo cambiar el usuario?** No.
- **¿Qué pasa si el Cliente está en más de una cuenta?** `session` devuelve el array `cuentas[]`.
  En la práctica un Cliente pertenece a una sola Cuenta.
- **¿Puedo eliminar dispositivos en una compartida?** No; las compartidas son solo lectura.
- **¿El cambio de contraseña/servicios se refleja en SENSA?** Sí; IPTVControl es la única vía, no se
  debe tocar SENSA directamente.
