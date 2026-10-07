# IPTVControl - Guía de integración API para sistemas de chat

## 1. Objetivo

Esta API permite que un sistema externo cree un Cliente Final y provisione su Cuenta IPTV sin
ingresar al panel de IPTVControl. Reutiliza las mismas reglas de negocio, aislamiento multi-tenant
e integración con el Proveedor que utiliza el panel.

Las solicitudes crean datos y Cuentas reales. No existe un modo de prueba o `dry-run`.

## 2. Datos que recibe el integrador

IPTVControl entrega por un canal seguro:

- `BASE_URL`: URL pública de IPTVControl.
- `API_KEY`: credencial privada asociada a una única Empresa Revendedora.

La API key no debe incluirse en aplicaciones web, mensajes, repositorios, capturas ni logs. Debe
usarse exclusivamente desde el servidor del sistema integrador.

## 3. Endpoint

```http
POST <BASE_URL>/api/v1/integration/whatsapp/customers
Content-Type: application/json
x-api-key: <API_KEY>
```

No utiliza Auth0. La Empresa Revendedora se determina mediante la configuración de la API key y no
puede elegirse desde el request.

## 4. Duplicados y reintentos

El alta es idempotente por datos, sin clave de idempotencia. Dentro de la misma Empresa Revendedora,
un **DNI**, un **teléfono** o un `id_gestion_externo` ya registrado en un Cliente Final activo o
suspendido rechaza el alta con `ACCOUNT_ALREADY_EXISTS`.

Reglas:

- Reintentar exactamente el mismo JSON no crea una segunda Cuenta: responde
  `ACCOUNT_ALREADY_EXISTS`.
- Un DNI o teléfono repetido también responde `ACCOUNT_ALREADY_EXISTS`, aunque el resto del request
  cambie.
- El único campo con confirmación explícita es `id_gestion_externo`: enviar
  `confirmar_duplicado: true` permite crear otro cliente con el mismo ID de CRM.
- Tras un timeout se puede reintentar el mismo JSON con seguridad; no hay UUID que conservar.

IPTVControl no guarda la respuesta de un alta anterior: un reintento confirmado como duplicado
devuelve el error, no las credenciales ya generadas.

## 5. Campos del request

| Campo | Tipo | Requerido | Validación / uso |
|---|---|---:|---|
| `nombre` | string | Sí | Entre 2 y 120 caracteres |
| `dni` | string | Sí | Entre 6 y 10 dígitos numéricos |
| `tipo_alta` | enum | Sí | `cuenta_exclusiva` o `dispositivo_compartido` |
| `apellido` | string | No | Máximo 120 caracteres |
| `telefono` | string | No | Máximo 30 caracteres |
| `email` | string | No | Email válido, máximo 160 caracteres |
| `direccion` | string | No | Máximo 200 caracteres |
| `id_gestion_externo` | string | No | ID del CRM externo, máximo 40 caracteres |
| `cupos_por_categoria` | 1 o 2 | Condicional | Obligatorio en `dispositivo_compartido`; omitir en exclusiva |
| `aislar_cuenta` | boolean | No | Sólo aplica a una venta compartida |
| `aislamiento_dias` | integer | Condicional | Obligatorio si `aislar_cuenta` es `true`; debe ser mayor a 0 |
| `dispositivo.nota_descriptiva` | string | No | Nota interna, máximo 200 caracteres |
| `confirmar_duplicado` | boolean | No | Permite crear otro cliente con el mismo `id_gestion_externo` |

Los campos opcionales `apellido`, `telefono`, `email`, `direccion` e `id_gestion_externo` pueden
omitirse o enviarse como `""`. Los campos desconocidos son rechazados.

El sistema externo no debe enviar MAC, tipo de Dispositivo, servicios, Cuenta destino ni duración
de la Ventana de Alta.

## 6. Modalidades

### Cuenta exclusiva

Siempre crea una Cuenta nueva para un único Cliente Final, con capacidad 3 fijos + 3 móviles.

```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "dni": "30123456",
  "telefono": "2615551234",
  "id_gestion_externo": "CRM-1042",
  "tipo_alta": "cuenta_exclusiva"
}
```

### Venta compartida 1+1

Reserva un fijo y un móvil. IPTVControl busca automáticamente la Cuenta compatible más antigua y
disponible; si no existe, crea una nueva.

```json
{
  "nombre": "Juan",
  "dni": "30123456",
  "id_gestion_externo": "CRM-1042",
  "tipo_alta": "dispositivo_compartido",
  "cupos_por_categoria": 1,
  "dispositivo": {
    "nota_descriptiva": "TV living"
  }
}
```

Para 2+2 se envía `"cupos_por_categoria": 2`.

### Venta compartida aislada

Siempre crea una Cuenta compartida nueva y evita que ingresen otros Clientes Finales durante el
período indicado.

```json
{
  "nombre": "Juan",
  "dni": "30123456",
  "tipo_alta": "dispositivo_compartido",
  "cupos_por_categoria": 1,
  "aislar_cuenta": true,
  "aislamiento_dias": 30
}
```

## 7. Respuesta exitosa

```json
{
  "success": true,
  "cliente": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "numero_cliente": 1042,
    "tipo_alta": "dispositivo_compartido"
  },
  "cuenta": {
    "id": "7c97bc26-fdda-4fc8-b42a-397389aa0111",
    "usuario": "13000002",
    "password": "12345678",
    "pin": "123456",
    "servicios": "1|2|3|4|5|6|7",
    "servicios_nombres": ["Básico"],
    "es_exclusiva": false
  },
  "cuenta_creada": true,
  "dispositivo_pendiente_de_activacion": false,
  "solicitud_vinculacion_id": null,
  "whatsapp": {
    "mensaje": "Texto listo para enviar al cliente",
    "plantilla_version": 1
  }
}
```

Las credenciales son sensibles. El integrador debe evitar registrarlas en logs y conservarlas sólo
durante el tiempo necesario para entregar el mensaje.

## 8. Errores

Los errores controlados responden HTTP 200 para que las plataformas de chat puedan mapear siempre
`whatsapp.mensaje`. El integrador debe evaluar `success`, no solamente el status HTTP.

```json
{
  "success": false,
  "whatsapp": {
    "mensaje": "Los datos enviados no son válidos o están incompletos."
  },
  "cuenta": {
    "usuario": null,
    "password": null,
    "pin": null
  },
  "error": {
    "code": "INVALID_DATA",
    "message": "Los datos enviados no son válidos o están incompletos."
  }
}
```

| Código | Significado | Acción recomendada |
|---|---|---|
| `ACCOUNT_ALREADY_EXISTS` | DNI, teléfono o ID de gestión ya registrado en la Empresa Revendedora | Revisar el cliente; no reintentar |
| `INVALID_DATA` | Datos faltantes, inválidos o combinación incompatible | Corregir el request |
| `RATE_LIMITED` | Se superaron 30 requests en 60 segundos | Esperar los segundos de `Retry-After` |
| `PROVIDER_AUTH` | Falló la autenticación con el Proveedor | Informar a soporte |
| `PROVIDER_UNAVAILABLE` | Proveedor o dependencia temporalmente no disponible | Reintentar el mismo JSON y consultar a soporte |
| `INTERNAL_ERROR` | Error no esperado | Informar a soporte con fecha y hora, sin credenciales |

## 9. Rate limit

El endpoint admite 30 solicitudes por cada ventana de 60 segundos para la API key configurada. No
es una cuota diaria. Al superar el límite, la operación no llega al Proveedor y la respuesta incluye
`RATE_LIMITED` y el header `Retry-After`.

El integrador no debe reintentar en bucle. Debe esperar `Retry-After` y puede reintentar el mismo
JSON: los duplicados por DNI, teléfono o ID de gestión están bloqueados.

## 10. Checklist del integrador

- Guardar `BASE_URL` y `API_KEY` como secretos del servidor.
- Enviar `Content-Type: application/json`.
- Evaluar `success` en todas las respuestas.
- Respetar `Retry-After`.
- No registrar API key, password ni PIN.
- No ejecutar pruebas automáticas contra producción sin autorización: las altas son reales.

## 11. Postman

La colección `IPTVControl_Bot.postman_collection.json` utiliza variables y no contiene
URL ni API key reales. Use DNIs y teléfonos no registrados en cada alta: repetir un request
existente responde `ACCOUNT_ALREADY_EXISTS` y no crea una segunda Cuenta.
