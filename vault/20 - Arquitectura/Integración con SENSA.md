---
tags: [arquitectura, integracion, sensa]
deriva-de: docs/API_Sensa_V4_1_3.pdf
implementado-en: backend/src/proveedor/sensa/
---

# Integración con SENSA

Referencia práctica de la API REST de SENSA **v4.1.3**, del lado de lo que usa IPTVControl. El
documento oficial completo es `docs/API_Sensa_V4_1_3.pdf`.

## Base

- URL: `https://<server>:<port>/v4/`
- Autenticación: **Basic Auth** (`<user>:<token>`)
- Toda respuesta viene con la misma envoltura:

```json
{
  "code": 200,
  "code_description": "Request was successful",
  "info": "…",
  "response": { },
  "user_facing_info": "…"
}
```

> El `code` del cuerpo es el que manda, no el status HTTP.

## Métodos que usa IPTVControl

| Operación de IPTVControl | Método SENSA |
|---|---|
| Probar conexión | `GET /v4/` |
| Crear Cuenta | `POST /v4/user/` |
| Ampliar/reducir capacidad | `PATCH /v4/user/<customer_id>` |
| Consultar Cuenta | `GET /v4/user/<customer_id>` |
| Cerrar Cuenta | `DELETE /v4/user/<customer_id>` |
| Parametrización de contenido | `GET /v4/user_services/<customer_id>` |
| Listar dispositivos (polling) | `GET /v4/user_devices/<customer_id>` |
| Crear reserva técnica | `POST /v4/device` (con MAC unicast administrada localmente) |
| Reasignar Dispositivo | `PUT /v4/device` existe en SENSA, pero IPTVControl no lo usa automáticamente ante colisiones |
| Baja de Dispositivo | `DELETE /v4/device/<device_id>` |
| Licencias contratadas | `GET /v4/licenses/` |

**No se usa** el módulo de hoteles: el modelo de reventa de IPTVControl trabaja con `user`.

## Mapeo de capacidad

IPTVControl aplica un máximo comercial global de **3 Dispositivos por Cuenta**, indistintamente del
tipo reportado por SENSA. La API expone tres campos técnicos:

- `auto_provision_count`
- `auto_provision_count_stationary`
- `auto_provision_count_mobile`

La interacción exacta entre esos campos, la autoprovisión y los Dispositivos de reserva debe
confirmarse antes del deploy mediante la prueba ya autorizada en una Cuenta SENSA productiva
dedicada. La prueba todavía no fue ejecutada y no reabre el máximo comercial global confirmado.

## Validaciones de la API que el adapter sanea

| Campo | Restricción | Qué hace el adapter |
|---|---|---|
| `dni` / `customer_id` | 7 u 8 dígitos | Genera y valida el correlativo |
| `first_name` / `last_name` | 3 a 20, sólo alfabéticos y espacios | Envía el nombre y apellido del contacto de la Empresa Revendedora; los del Cliente Final quedan locales |
| `mobile_phone` | 7 a 10 dígitos | Usa el teléfono del Cliente Final con fallback al de la Empresa Revendedora |
| Dirección | Según contrato SENSA | Usa la del Cliente Final con fallback a la de la Empresa Revendedora |
| `password` | 8 a 20, sólo numérica | Genera exactamente 8 dígitos y los cifra |
| `pin` | 4 a 8, sólo numérico | Genera exactamente 6 dígitos y los cifra |
| `email` | único en el sistema | Deriva del correo de la Empresa Revendedora + correlativo |
| `external_customer_id` | hasta 40 alfanuméricos | Usa el ID interno de la Cuenta sin guiones |
| `mac` | 12 hexadecimales | Normaliza a mayúsculas sin separadores |

`id_gestion_externo` nunca se envía a SENSA.

## Códigos de error relevantes

| Código | Significado | Reacción de IPTVControl |
|---|---|---|
| 803 / 1002 | Usuario ya existe | **Incrementar el DNI y reintentar** (no se muestra al usuario) |
| 805 | Email ya existe | Avanzar el correlativo del correo y reintentar |
| 701–708 | Validación de datos | Error de validación: reintentar no sirve |
| 820 | Datos no modificados | Se tolera: el estado deseado ya estaba |
| 806 | Dispositivo ya existe | Reporta la colisión; nunca reasigna automáticamente el Dispositivo existente |
| 901 / 903 | No existe | En bajas se trata como éxito |
| 401 / 403 | Autenticación | Proveedor no disponible (problema de configuración) |
| 500 / 503 / 1001 / 1003 | Falla del lado del Proveedor | Mensaje de negocio + cola de reintentos |

## Paquetes de contenido (Anexo de Servicios)

| Código | Paquete |
|---|---|
| 1 | Básico — **obligatorio**, no se puede eliminar |
| 2 | Hot Pack — sólo en el reproductor web |
| 3 | Universal Plus |
| 4 | Pack Futbol |
| 5 | HBO Premium |
| 6 | GOLF TV |
| 7 | CINDIE |

## Dos limitaciones que condicionan el diseño

1. **No hay webhooks.** Toda actualización es por consulta activa (polling). De ahí el job de
   reconciliación de dispositivos.
2. **No hay ambiente de prueba.** Las pruebas de integración van directo contra producción de SENSA,
   con Cuentas ya abonadas por Tecnología Activa. No existe modo "dry-run".

## Ver también

- [[Patrón ProveedorAdapter]]
- [[Consistencia con el Proveedor]]
