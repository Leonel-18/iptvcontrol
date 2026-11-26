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

El Portal de Cliente permite que un Cliente Final de **una Empresa Revendedora** (definida por la
credencial de integración) pueda:

1. **Consultar** sus credenciales (`usuario`, `password`, `pin`), sus **servicios** y sus
   **dispositivos**.
2. En **cualquier cuenta**, **administrar** contraseña, PIN y servicios por el
   `proveedor_cuenta_id`. En cuentas compartidas se exige confirmación porque afecta a todos los
   Clientes Finales. La gestión de dispositivos también usa el ID de la Cuenta en el Proveedor.

En **cuentas compartidas** el Cliente ve únicamente los dispositivos que la Empresa Revendedora le
asignó.

No existe modo de prueba o `dry-run`. Las operaciones de escritura son **reales**: cambian datos en
IPTVControl y en el Proveedor (SENSA).

---

## 2. Lo que IPTVControl entrega al integrador

Por un canal seguro, se entregan dos valores:

- `BASE_URL`: URL pública de IPTVControl (ej. `https://iptvcontrol.com.ar`).
- `API_KEY`: credencial privada de **una Empresa Revendedora**, creada por el Operador Principal en
  **Configuración → Integraciones**. La credencial tiene permisos seleccionables por operación; por
  defecto se otorgan todos.

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
| Cuenta **compartida** | Varios Clientes Finales comparten la misma Cuenta y credenciales. Las ediciones de contraseña/PIN/servicios requieren confirmación explícita. |
| Servicios | Paquetes de contenido (códigos). Se validan contra lo contratado por el Operador Principal. |
| Dispositivo | Equipo del Cliente. En SENSA se identifica por `proveedor_device_id`. |
| Incidencia | Dispositivo detectado en el Proveedor **sin dueño asignado** en IPTVControl. El Cliente (cuenta exclusiva) puede reclamarlo. |

**Reglas invariables:**

1. El **usuario** de una Cuenta **nunca** se puede cambiar.
2. Los **servicios** se validan contra lo contratado; no se pueden inventar. El paquete básico se
   agrega siempre.
3. Un Cliente solo puede operar sobre **sus** cuentas. IPTVControl revalida la titularidad en cada
   request; el portal no es la única barrera.
4. La Empresa Revendedora de la integración es la **de la credencial**. El portal no puede elegir a
   qué Empresa pertenece un DNI.

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
| `403` | Regla de negocio: cuenta ajena, cuenta inactiva o escritura no permitida | Mostrar en modo lectura; no reintentar |
| `404` | DNI o cuenta o dispositivo inexistente | Mostrar "no encontrado" |
| `409` | `SharedAccountConfirmationRequired`: falta confirmar un cambio de contraseña en cuenta compartida | Mostrar la advertencia y reenviar con `confirmar_cambio_compartida: true` |
| `429` | Rate limit | Esperar y reintentar con backoff |
| `503` | Integración no habilitada o dependencia caída | Reintentar más tarde |
| `500` | Error inesperado | Reintentar; avisar a soporte con fecha/hora |

El cuerpo de error sigue el formato de NestJS:

```json
{
  "statusCode": 409,
  "error": "SharedAccountConfirmationRequired",
  "message": "Esta Cuenta es compartida: cambiar la contraseña afecta a TODOS sus Clientes Finales. Reenviar el request con \"confirmar_cambio_compartida\": true para continuar.",
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
      "puede_cambiar_password": true,
      "requiere_confirmacion_cambio_compartida": false,
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
| `puede_editar` | `true` si la Cuenta está activa. Las ediciones usan el `proveedor_cuenta_id`. |
| `puede_cambiar_password` | `true` si la Cuenta está activa |
| `requiere_confirmacion_cambio_compartida` | `true` en Cuentas compartidas: antes de cambiar contraseña/PIN/servicios hay que confirmar |
| `es_prueba` / `prueba_vence_en` | Si es cuenta de prueba, avisar al usuario que se cierra sola en esa fecha |
| `aislada` | Cuenta compartida que no recibe clientes nuevos temporalmente |
| `servicios` | Cadena de códigos (ej. `"1|3|5"`) para enviar en el cambio de servicios |
| `servicios_nombres` | Nombres legibles de esos códigos |
| `dispositivos` | En **compartida**: solo los asignados a este Cliente. En **exclusiva**: los de la cuenta |

**Errores:** `404` si no hay un Cliente Final con ese DNI. `429` si se supera el límite (30/min).

> **Importante:** las operaciones sobre una Cuenta usan el `proveedor_cuenta_id` que devuelve
> `session` (ej. `3000002`), no el `id` interno ni el DNI. El DNI solo se usa para `session` y para
> asignar un dispositivo detectado a un Cliente.

---

### 6.2. `PATCH /accounts/{proveedorCuentaId}/password` — Cambiar contraseña

Funciona en cuentas exclusivas y compartidas. La Cuenta se identifica por su **ID en el Proveedor**
(ej. `3000002`), no por el UUID interno ni por el DNI.

```http
PATCH /api/v1/integration/portal-cliente/accounts/{proveedorCuentaId}/password
Content-Type: application/json
x-api-key: <API_KEY>

{ "password": "87654321" }
```

- `password`: numérica, **8 a 20 dígitos**.
- En **cuenta exclusiva**: `200` con `cuenta_compartida: false`.
- En **cuenta compartida**: primero responde **409** `SharedAccountConfirmationRequired`. Reenviar
  con `"confirmar_cambio_compartida": true`; la respuesta incluye `cuenta_compartida: true` y
  `advertencia`, porque la contraseña nueva afecta a **todos** los Clientes Finales.

---

### 6.3. `PATCH /accounts/{proveedorCuentaId}/pin` — Cambiar PIN

Funciona en cuentas exclusivas y compartidas.

```http
PATCH /api/v1/integration/portal-cliente/accounts/{proveedorCuentaId}/pin
x-api-key: <API_KEY>

{ "pin": "654321" }
```

- `pin`: numérico, **6 dígitos**.
- En compartida, reenviar con `"confirmar_cambio_compartida": true`.
- `200` con `cuenta_compartida` y `advertencia`.

---

### 6.4. `PATCH /accounts/{proveedorCuentaId}/services` — Cambiar servicios

Funciona en cuentas exclusivas y compartidas.

```http
PATCH /api/v1/integration/portal-cliente/accounts/{proveedorCuentaId}/services
x-api-key: <API_KEY>

{ "servicios": ["1", "3", "5"] }
```

- Se validan contra lo contratado por el Operador Principal. El básico (`"1"`) se agrega siempre.
- En compartida, reenviar con `"confirmar_cambio_compartida": true`.
- `400` si algún servicio no está contratado.

---

### 6.5. `POST /accounts/{proveedorCuentaId}/devices/sync` — Ver dispositivos del Proveedor

Consulta el inventario real de la Cuenta en SENSA. Funciona en exclusivas y compartidas.

```http
POST /api/v1/integration/portal-cliente/accounts/{proveedorCuentaId}/devices/sync
x-api-key: <API_KEY>
```

Sin body. Devuelve `clasificacion: "vinculado"` o `"desconocido"` (este último con `incidencia_id`).

---

### 6.6. `POST /accounts/{proveedorCuentaId}/devices/claim` — Reclamar un dispositivo

Asigna un dispositivo detectado sin dueño a un Cliente Final. El DNI sigue siendo necesario porque
define el destinatario.

```http
POST /api/v1/integration/portal-cliente/accounts/{proveedorCuentaId}/devices/claim
x-api-key: <API_KEY>

{ "dni": "30123456", "proveedor_device_id": "40009999" }
```

- `proveedor_device_id` se obtiene del `sync`.
- En una compartida, el Cliente debe pertenecer a esa Cuenta (venta o dispositivo).
- `404` si no hay una incidencia pendiente con ese ID.
- `200` → incidencia resuelta y `dispositivo_id` vinculado.

---

### 6.7. `POST /accounts/{proveedorCuentaId}/devices/{proveedorDeviceId}/remove` — Dar de baja un dispositivo

**IRREVERSIBLE.** Funciona en exclusivas y compartidas; usa el ID del dispositivo en el Proveedor.

```http
POST /api/v1/integration/portal-cliente/accounts/{proveedorCuentaId}/devices/{proveedorDeviceId}/remove
x-api-key: <API_KEY>
```

Sin body. Elimina el Dispositivo en el Proveedor y borra la fila local. `404` si no pertenece a la
Cuenta; `400` si está bloqueado por suspensión. Requiere `confirmar_baja_definitiva: true`; sin ese
campo responde `409 DeviceRemovalConfirmationRequired`.

---

### 6.8. `GET /accounts/{proveedorCuentaId}` — Leer Cuenta por ID de proveedor

Devuelve estado, credenciales, servicios y **todos** los dispositivos de la Cuenta, con su dueño.
Permiso: `clientes.leer`.

```http
GET /api/v1/integration/portal-cliente/accounts/3000002
x-api-key: <API_KEY>
```

---

### 6.9. `GET /customers?dni=...` — Buscar Cliente

Búsqueda liviana por DNI o `id_gestion_externo`. Devuelve datos de contacto y cuentas, sin
credenciales ni dispositivos. Permiso: `clientes.leer`.

```http
GET /api/v1/integration/portal-cliente/customers?dni=30123456
x-api-key: <API_KEY>
```

También: `GET /customers?id_gestion_externo=CRM-1042`.

---

### 6.10. `PATCH /customers/{dni}` — Actualizar datos de contacto

Permite cambiar `nombre`, `apellido`, `telefono`, `email`, `direccion` e `id_gestion_externo`.
Permiso: `clientes.editar`.

```http
PATCH /api/v1/integration/portal-cliente/customers/30123456
x-api-key: <API_KEY>

{ "telefono": "2615550001", "email": "cliente@example.com" }
```

---

### 6.11. `POST /customers/{dni}/suspend|reactivate|terminate`

- `suspend`: suspende y reserva los Dispositivos.
- `reactivate`: reactiva al Cliente y sus Dispositivos.
- `terminate`: baja definitiva; elimina sus Dispositivos y libera las Cuentas. Requiere
  `{ "confirmar_baja_definitiva": true }`; sin ese campo responde `409`
  `ClientTerminationConfirmationRequired`.
- Permiso: `clientes.estado`.

---

### 6.12. `GET /accounts/{proveedorCuentaId}/devices/{proveedorDeviceId}` — Leer Dispositivo

Devuelve estado, MAC, modelo, último inicio y Cliente dueño. Permiso: `dispositivos.leer`.

```http
GET /api/v1/integration/portal-cliente/accounts/3000002/devices/40009999
x-api-key: <API_KEY>
```

---

## 7. Reglas de autorización (doble capa)

El portal debe aplicar **dos capas**:

1. **UX (portal):** usar `cuenta.puede_editar` y
   `cuenta.requiere_confirmacion_cambio_compartida` para mostrar las acciones y la advertencia.
2. **Seguridad (IPTVControl):** cada escritura revalida en el servidor. Aunque el portal llame de
   más, IPTVControl responde:
   - `409` `SharedAccountConfirmationRequired` si falta confirmar un cambio en una compartida.
   - `403` "La Cuenta no está activa."
   - `404` si la Cuenta no existe en la Empresa de la credencial.
   - `403` si falta el permiso de integración (`cuentas.editar` / `dispositivos.gestionar`).

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

### 8.2. Edición (cualquier cuenta, por ID de proveedor)

```
1. session → obtener proveedor_cuenta_id.
2. Cambiar contraseña:  PATCH /accounts/{proveedorCuentaId}/password
   Cambiar PIN:         PATCH /accounts/{proveedorCuentaId}/pin
   Cambiar servicios:   PATCH /accounts/{proveedorCuentaId}/services
   Si requiere_confirmacion_cambio_compartida === true, mostrar la advertencia y reenviar
   con "confirmar_cambio_compartida": true.
3. Refrescar con POST /session (o usar la respuesta) para reflejar el cambio.
```

### 8.3. Dispositivos (cualquier cuenta, por ID de proveedor)

```
1. POST /accounts/{proveedorCuentaId}/devices/sync   → vinculado / desconocido
2. Para un "desconocido" con incidencia_id:
      POST /accounts/{proveedorCuentaId}/devices/claim { dni, proveedor_device_id }
3. Para un dispositivo propio:
      POST /accounts/{proveedorCuentaId}/devices/{proveedorDeviceId}/remove
      (ADVERTIR: irreversible)
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
- [ ] Basar la UI en `cuenta.puede_editar` y `requiere_confirmacion_cambio_compartida`.
- [ ] Usar `cuenta.proveedor_cuenta_id` para editar, no el `id` interno ni el DNI.
- [ ] Antes de cambiar contraseña/PIN/servicios de una compartida, mostrar la advertencia y
      reenviar con `confirmar_cambio_compartida: true`.
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
(`baseUrl`, `apiKey`, `dni`, `proveedorCuentaId`, `proveedorDeviceId`) y no contiene datos
reales. Orden sugerido: **Sesión → Sync → Claim → Remove**.

---

## 12. Preguntas frecuentes / límites conocidos

- **¿Puedo consultar por DNI a un cliente de otra Empresa Revendedora?** No. La credencial está
  asociada a una Empresa Revendedora; el DNI se busca solo dentro de esa Empresa. Para otra empresa
  se usa otra credencial.
- **¿El DNI alcanza como seguridad?** No por sí solo. La seguridad la da la API key server-to-server
  y el hecho de que el portal autentica a su usuario antes. Tratar la API key como secreto crítico.
- **¿Puedo cambiar el usuario?** No.
- **¿Qué pasa si el Cliente está en más de una cuenta?** `session` devuelve el array `cuentas[]`.
  En la práctica un Cliente pertenece a una sola Cuenta.
- **¿Puedo eliminar dispositivos en una compartida?** No; esas operaciones son solo para exclusivas.
  La única escritura permitida en una compartida es **cambiar la contraseña**, con confirmación
  explícita porque afecta a todos sus Clientes Finales.
- **¿El cambio de contraseña/servicios se refleja en SENSA?** Sí; IPTVControl es la única vía, no se
  debe tocar SENSA directamente.
