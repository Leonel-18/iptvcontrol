# IPTVControl — URL Structure / Routing Convention

> Documento de referencia para el equipo de desarrollo. Define las rutas del front-end en inglés,
> genéricas y desacopladas de la terminología específica de SENSA. El glosario oficial en español
> (`01_Instrucciones_del_Proyecto.md`, `02_Glosario_de_Actores_y_Entidades.md`) sigue rigiendo en
> código de backend, base de datos y documentación interna — esta tabla es la capa de traducción
> hacia la UI.

## 1. Principios aplicados

1. **Sustantivos en plural, inglés, kebab-case** para rutas de más de una palabra (`commercial-plans`, no `commercialPlans` ni `commercial_plans`).
2. **Nesting máximo de 1 nivel.** Evitamos `/resellers/:id/accounts/:id/devices/:id`. Cada entidad con ID propio (Cuenta, Dispositivo, Cliente) tiene su propia ruta plana `/devices/:id`; la relación jerárquica se resuelve con filtros por query param o con el estado de navegación de la UI (breadcrumbs), no con URLs profundas. Esto simplifica los componentes de router y evita romper enlaces si un Dispositivo migra de Cuenta (ver flujo 4.4 del esqueleto técnico).
3. **Multi-tenancy invisible en la URL.** La misma ruta (`/customers`) sirve tanto al panel del Operador Principal como al de una Empresa Revendedora — lo que cambia es el *scope* de datos que devuelve el backend según el token de sesión, no la URL. Esto es justamente lo que pediste con "desacoplada de la lógica específica de negocio": la ruta no necesita saber quién la está mirando.
4. **Filtros como query params**, no como segmentos de ruta: `/customers?reseller_id=45&status=active`.

## 2. Tabla de rutas

| Concepto (glosario ES) | Ruta (inglés genérico) | Notas |
|---|---|---|
| Inicio | `/dashboard` | Contenido varía según rol (Operador Principal ve KPIs globales; Empresa Revendedora ve solo los propios) |
| Revendedores (**Empresa Revendedora**) | `/resellers` | Visible solo para Operador Principal |
| Revendedor específico | `/resellers/:id` | Alta/edición, modalidad comercial asignada, escala |
| Cuentas (**Cuenta**) | `/accounts` | Listado — Operador Principal ve todas, Empresa Revendedora solo las propias |
| Cuenta específica | `/accounts/:id` | Detalle: usuario/password/PIN SENSA, ocupación 3+3 |
| Clientes (**Cliente Final**) | `/customers` | Alta con selector `cuenta_exclusiva` / `dispositivo_compartido` |
| Cliente específico | `/customers/:id` | Incluye sus Dispositivos asociados |
| Dispositivos (**Dispositivo**) | `/devices` | Listado global, filtrable por `?account_id=` o `?customer_id=` |
| Dispositivo específico | `/devices/:id` | Estado: activo / bloqueado_por_suspension / disponible / dado_de_baja |
| Planes comerciales (**Modalidad Comercial**) | `/commercial-plans` | Gestión exclusiva del Operador Principal |
| Plan específico | `/commercial-plans/:id` | Menudeo / obligación mensual, escala X5-X10 |
| Proveedores (**Proveedor**) | `/providers` | Hoy un único registro (SENSA); preparado para multi-proveedor post-MVP |
| Reportes | `/reports` | Incluye exportación a CSV de Clientes y Dispositivos — ver 3.1 |
| Registro de auditoría (**Audit Log**) | `/audit-log` | Operador Principal ve todo el historial (con la misma restricción de campos que `/customers`/`/devices`, sección 5.3); Empresa Revendedora ve solo el propio |
| Miembros del equipo (logins de panel) | `/team-members` | Ver sección 4.3 — se renombró desde `/users` para eliminar ambigüedad con `Customer` |
| Configuración | `/settings` | `dni_inicial_sensa`, credenciales/API keys del Proveedor, parametrización general |

## 3. Ejemplos de rutas anidadas resueltas por query param (no por segmento)

```
/devices?account_id=456          → Dispositivos de una Cuenta puntual
/devices?customer_id=789         → Dispositivos de un Cliente Final puntual
/customers?reseller_id=123        → Clientes de una Empresa Revendedora puntual (vista Operador Principal)
/accounts?reseller_id=123&status=active
```

## 4. Decisión confirmada por Bruno: inglés en URLs y en componentes de UI

El front-end (rutas **y** nombres de componentes) se maneja en inglés genérico. El glosario en
español (`02_Glosario_de_Actores_y_Entidades.md`) sigue siendo la fuente de verdad en
**base de datos y lógica de negocio de backend** (nombres de tablas, campos, funciones,
documentación) — no cambia. La traducción ocurre en la capa de presentación (rutas + componentes
React), igual que ya ocurre hoy en cualquier librería de UI en inglés que uses sobre datos en
español.

### 4.1. Convención de nombres de componentes

Mismo criterio que las rutas: **PascalCase, inglés, genérico**, con el sufijo indicando el tipo de
componente. Mapeo directo 1 a 1 con las entidades del glosario, para que cualquier dev pueda
ubicar el componente a partir de la ruta y viceversa.

| Entidad (glosario ES) | Recurso genérico (inglés) | Componentes sugeridos |
|---|---|---|
| Empresa Revendedora | Reseller | `ResellerList`, `ResellerDetail`, `ResellerForm` |
| Cuenta | Account | `AccountList`, `AccountDetail`, `AccountDevicesTab` |
| Cliente Final | Customer | `CustomerList`, `CustomerDetail`, `CustomerForm` |
| Dispositivo | Device | `DeviceList`, `DeviceDetail`, `DeviceStatusBadge` |
| Modalidad Comercial | CommercialPlan | `CommercialPlanList`, `CommercialPlanForm` |
| Proveedor | Provider | `ProviderSettings` |
| Miembros del equipo (logins de panel) | TeamMember | `TeamMemberList`, `TeamMemberForm` |
| Registro de auditoría | AuditLog | `AuditLogList`, `AuditLogEntry` |
| — | — | `Dashboard`, `ReportsView`, `SettingsView` |

### 4.2. Dónde vive el mapeo español↔inglés en el código

Para que el mapeo no quede disperso ni dependa de la memoria de cada dev, conviene centralizarlo en
un único punto del código — por ejemplo un archivo `entityLabels.ts` (o `.js`) en el front-end, que
traduzca el nombre técnico en inglés (`reseller`, `device`, `status`) al texto que ve el usuario
final en español (`"Empresa Revendedora"`, `"Dispositivo"`, `"Activo"`). Así:

- Los componentes, rutas y variables se escriben y leen en inglés (más fácil de mantener si en el
  futuro suman devs que no hablan español, y es el estándar de la industria).
- La UI que ve el usuario (Operador Principal, Empresa Revendedora) sigue mostrando el glosario
  oficial en español, sin que el usuario final note la capa técnica de por medio.

### 4.3. `/users` → `/team-members`: por qué el cambio de nombre

El problema de fondo no era solo de documentación: la palabra **"User"** es ambigua por diseño.
En la mayoría de las apps SaaS "usuario" puede referirse tanto a quien *usa el servicio*
(en tu caso sería el Cliente Final) como a quien *administra el sistema* (en tu caso, el
personal del Operador Principal o de una Empresa Revendedora que entra al panel). Como las dos
cosas son entidades completamente distintas en IPTVControl —el Cliente Final ni siquiera tiene
login propio, según el glosario— dejar `/users` como nombre genérico obliga a cualquier dev nuevo
a "adivinar" cuál de los dos significados aplica, y ese tipo de ambigüedad es exactamente lo que
genera bugs de permisos en sistemas multi-tenant (mostrarle a alguien datos que no debería ver).

**Analogía:** pensalo como Stripe o Notion, que separan claramente "Team" (la gente que entra al
back office a administrar la cuenta) de "Customers" (la gente a la que le vendés, que nunca inicia
sesión en tu sistema). Vos ya tenés esa misma separación conceptual en el glosario —Cliente Final
no tiene acceso propio—, así que conviene que el nombre técnico la refleje en vez de esconderla
detrás de una palabra ambigua.

**Propuesta concreta:**

- Ruta: `/team-members` (en vez de `/users`).
- Componentes: `TeamMemberList`, `TeamMemberDetail`, `TeamMemberForm`.
- Dentro de esta misma entidad conviven dos roles, distinguidos por un campo `role` (no por rutas
  separadas, siguiendo el mismo criterio de "multi-tenancy invisible en la URL" de la sección 1):
  - `operator_admin` / `operator_staff` → personal del Operador Principal (Tecnología Activa).
  - `reseller_admin` / `reseller_staff` → personal de una Empresa Revendedora, con acceso solo a
    los datos de su propia empresa.
- El backend sigue devolviendo únicamente los `team-members` del tenant correspondiente al token
  de sesión — mismo mecanismo de scope automático que ya definimos para `/customers` y `/accounts`.

Este término (`Team Member` / "Miembro del equipo") **ya está incorporado al glosario oficial**
(`02_Glosario_de_Actores_y_Entidades.md`), como entidad de acceso técnico —distinta de los actores
de negocio— con roles `operator_admin` / `operator_staff` / `reseller_admin` / `reseller_staff`. Si
preferís mostrarlo en español en la UI visible para el usuario final, se traduciría como
**"Usuarios del panel"** o **"Equipo"**, vía la misma capa de `entityLabels.ts` mencionada en 4.2.

### 4.4. Excepción a la ruta `/team-members`: el primer Team Member root

El primer `operator_admin` (el de Tecnología Activa) **no se crea a través de `/team-members`**, ni
de ningún flujo de la UI: se provisiona mediante un seed ejecutado al desplegar el sistema, porque
en ese momento todavía no existe nadie con permisos para dar de alta al primero. El detalle técnico
del mecanismo está en `04_Esqueleto_Tecnico_Inicial.md`, sección 4.6. Una vez que ese primer usuario
existe, el resto de los Team Members (tanto `operator_staff` a futuro como todos los
`reseller_admin`/`reseller_staff`) sí se dan de alta normalmente desde `/team-members`.

## 5. Mejoras incorporadas — impacto en rutas y comportamiento de la API

### 5.1. `/audit-log`

Ruta nueva, mismo criterio de scope automático por token de sesión que el resto: el Operador
Principal ve el historial completo, cada Empresa Revendedora ve solo el propio. Soporta los mismos
filtros por query param que el resto de los listados, por ejemplo:

```
/audit-log?entity=customer&entity_id=789   → Historial de acciones sobre un Cliente Final puntual
/audit-log?action=cambio_precio            → Historial de cambios de precio
```

Ver reglas de negocio completas en `03_Reglas_de_Negocio.md`, sección 11.

### 5.2. Exportación CSV

No es una ruta nueva de navegación, sino un **comportamiento adicional sobre rutas existentes**,
vía query param — mismo principio de la sección 1.4 (filtros como query params, no como segmentos):

```
GET /customers?format=csv    → descarga el listado de Clientes Finales en CSV en vez de JSON
GET /devices?format=csv      → descarga el listado de Dispositivos en CSV
```

Esto evita crear rutas paralelas tipo `/customers/export` — el backend simplemente cambia el
`Content-Type` de la respuesta según el parámetro, reutilizando el mismo endpoint y sus filtros
(`?reseller_id=`, `?status=`, etc.). Ver `03_Reglas_de_Negocio.md`, sección 13.

### 5.3. Vista restringida del Operador Principal sobre `/accounts` y `/devices`

**No es una ruta nueva** — es un cambio en qué campos devuelve el backend según el rol del token de
sesión, siguiendo el mismo principio de "multi-tenancy invisible en la URL" de la sección 1.3: la
URL `/accounts/:id` es la misma para ambos roles, pero cuando la consulta un `operator_admin`, la
respuesta **omite** `usuario`/`password`/`pin` de la Cuenta y `nombre`/`datos de contacto` y
`nota_descriptiva` del Cliente Final asociado — nunca llegan al front-end, no es un tema de
ocultarlos visualmente en el componente. Esto es intencional: dado que el Operador Principal
también vende IPTV, no debe tener visibilidad comercial sobre la cartera de sus Empresas
Revendedoras. Tabla completa de campos permitidos/prohibidos en `03_Reglas_de_Negocio.md`, sección
4.2.
