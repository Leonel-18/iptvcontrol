---
tags: [decision, pendiente]
deriva-de: docs/05_Decisiones_Pendientes.md
estado: ABIERTO
---

# Decisiones pendientes

> [!warning] Nadie —humano o agente— debe asumir una resolución para estos puntos
> La lista normativa y actualizada está en `docs/05_Decisiones_Pendientes.md`. Esta nota la refleja y
> agrega, en cada caso, **cómo quedó implementado provisoriamente** para que la decisión final sea un
> ajuste y no un refactor.

## 1 · Comercial

| Pendiente | Estado en el código |
|---|---|
| Modelo de licenciamiento de IPTVControl hacia otros distribuidores | No bloquea: el modelo ya soporta varios Operadores Principales |

### Interpretación aplicada: el alta de Operadores Principales

El alcance del MVP menciona *"Alta de Operadores Principales, Empresas Revendedoras y Clientes
Finales"*. Las dos últimas se dan de alta desde el panel. La primera, en cambio, **se provisiona con
el seed** (`npm run seed:root`) y no tiene pantalla propia.

El razonamiento, para que se pueda revisar:

1. **No hay ningún actor que pueda crearlo.** El glosario define cuatro roles de Team Member, y todos
   pertenecen a un tenant: o al Operador Principal, o a una Empresa Revendedora. No existe un rol por
   encima del Operador Principal, y no se inventó uno.
2. **El glosario dice que cada Operador Principal tiene su propia instancia**: *"cada distribuidor que
   adopte IPTVControl en el futuro sea un Operador Principal independiente, con su propia
   instancia/aislamiento de datos"*. Un Operador nuevo es un despliegue nuevo con su propio seed.
3. **`docs/04` §4.6 ya define el seed como el mecanismo de creación** del primer Operador Principal,
   junto con el Proveedor y el primer `operator_admin`.

Lo que sí se puede editar desde el panel son sus **parámetros** (identificador inicial, umbral de
alerta, reintentos, conexión al Proveedor), en Configuración.

> **A confirmar con Bruno o Federico:** si la intención era que un mismo despliegue administre varios
> Operadores Principales desde una pantalla, hace falta definir primero **quién** tendría permiso para
> hacerlo — es decir, un rol nuevo por encima del Operador Principal. Eso queda atado al modelo de
> licenciamiento, que es el primer pendiente de esta lista.

## 2 · Autenticación y provisioning (Auth0)

| Pendiente | Estado en el código |
|---|---|
| Seed manual vs. automático al arrancar el contenedor | Implementado como **script manual** (`npm run seed:root`), pero **idempotente**: si se decide automatizarlo, ya se puede enganchar sin cambios |
| Quién envía el correo de invitación | El backend **devuelve la URL del ticket**; el panel la muestra para pasarla a mano. Falta enchufar un servicio de correo (SendGrid / Resend / SMTP) |
| `ttl_sec` del enlace de invitación | 72 h por defecto, **configurable** por variable de entorno (`AUTH0_INVITATION_TTL_SEC`) |
| Reenvío de invitación | **Implementado**: botón "Reenviar" que genera un ticket nuevo sin recrear el usuario |
| Evaluar Auth0 Organizations a mediano plazo | Descartado para el MVP. El vínculo tenant↔TeamMember es un FK simple, así que migrar no obliga a rehacer el modelo |

## 3 · Seguridad de datos sensibles

| Pendiente | Estado en el código |
|---|---|
| Control de quién puede ver contraseña y PIN de Cuenta | El Operador Principal **no accede nunca** (regla 4.2, con test). Del lado revendedor puede verlos su `reseller_admin` |
| ¿Registrar cada consulta a esos campos? | **Sin decidir.** El acceso está concentrado en un único método (`CuentasService.obtenerCredenciales`) para que sumar el registro sea un cambio de una línea |

Además, el panel ya no los muestra de entrada: hay que pedir "Ver credenciales" y cada valor se
revela de a uno. Es una mitigación de la exposición accidental en pantalla, no la decisión pendiente.

## 4 · Integración SENSA — casos límite

| Pendiente | Estado en el código |
|---|---|
| ¿Límite de reintentos ante identificador repetido, o reintento infinito? | Implementado con **límite configurable** (por defecto 25). Al agotarse corta con error y queda la traza. No reintenta indefinidamente |

## 5 · Parametrización — umbrales y validaciones

| Pendiente | Estado en el código |
|---|---|
| ¿Umbral de alerta fijo en 2 de 3 o configurable? | Implementado **configurable** desde Configuración, con 2 por defecto |
| Formato del CUIT | Implementado como **string de 11 dígitos sin guiones**, validado en el backend, por consistencia con el campo `cuit` de SENSA. **A confirmar** |

## 6 · Menú de Parametrización

| Pendiente | Estado en el código |
|---|---|
| Nombres y contrato de los tres endpoints | Implementados tal como los propone `docs/04` §9.3: `GET`/`PATCH /settings/sensa` y `POST /settings/sensa/test-connection`. **A validar** |
| ¿`operator_admin` sin restricción o sub-permiso? | Hoy accede todo `operator_admin` |
| Conectar el prototipo de referencia a los endpoints reales | **Hecho**: `SettingsView.tsx` reemplaza a `sensa_settings_menu.jsx`, con guardado y test reales |
| Resto de secciones del menú | Se agregaron las que la integración necesitaba (ciudad y contenido por defecto). El resto se documenta a medida que se defina |

## 7 · Documentación

| Pendiente | Estado |
|---|---|
| Vault de Obsidian desde cero | **Hecho** — es este vault |
| Estructura de carpetas del repo | **Hecha** — ver [[Stack técnico]] |
| Mapeo técnico + UX con el flujo de 5 fases | Pendiente: requiere el flujo propio de Tecnología Activa |

## Recordatorio

El **documento de tareas de Federico** está **descartado definitivamente** como fuente de referencia:
contradice decisiones ya confirmadas (facturación fuera del MVP, X5/X10 vs. FULL/RETAIL, baja
individual de dispositivo, ausencia del `ProveedorAdapter`). La única fuente de verdad es `docs/` más
el PDF de la API de SENSA.

## Ver también

- [[Riesgo aceptado - contraseña compartida]] — esto **no** es un pendiente
