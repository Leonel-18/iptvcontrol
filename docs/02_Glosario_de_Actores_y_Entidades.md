# IPTVControl — Glosario de Actores y Entidades

Este documento define la nomenclatura oficial del proyecto. Usar siempre estos nombres en el
código, la base de datos y la documentación, para evitar ambigüedad entre "cuenta", "usuario",
"licencia", "dispositivo" y "cupo". La unidad oficial es **Dispositivo**; para capacidad libre se
usa **cupo**.

## Actores (roles de negocio)

### Proveedor
La plataforma de contenido IPTV sobre la que corre el servicio. Hoy es **SENSA**. El sistema debe
diseñarse para que este actor sea reemplazable en el futuro (conector desacoplado), aunque en esta
etapa solo se implemente la integración con SENSA.

### Operador Principal
Empresa responsable total de la infraestructura y titular del contrato comercial con el Proveedor.
Es quien crea las Cuentas en el Proveedor vía API, define las modalidades comerciales disponibles
y los precios. **Tecnología Activa es el primer Operador Principal**, pero el sistema está diseñado
para que cada distribuidor que adopte IPTVControl en el futuro sea un Operador Principal
independiente, con su propia instancia/aislamiento de datos.

### Empresa Revendedora
Empresa (típicamente un ISP) que le compra Cuentas al Operador Principal para revenderlas a sus
propios Clientes Finales. Opera bajo **una sola modalidad comercial** (al menudeo o con obligación
mensual, nunca ambas simultáneamente), definida y modificada exclusivamente por el Operador
Principal (downgrade o upgrade de escala), y define **sus propios precios** hacia el Cliente Final.
Tiene su propio login y panel de administración, con aislamiento total de datos respecto a otras
Empresas Revendedoras y respecto al propio Operador Principal (multi-tenant). El Operador Principal
puede identificarla por ID para brindar soporte, sin necesidad de ver sus datos sensibles.

Su registro como entidad legal/comercial incluye: **razón social**, **CUIT**, **dirección**,
**nombre y apellido** de un contacto principal, **teléfono**, **correo electrónico** (que además es
la base para generar los correos de contacto de cada Cuenta — ver `03_Reglas_de_Negocio.md`,
sección 2.3) y, opcionalmente, un **link a su sitio web**. Estos datos los carga el Operador
Principal al dar de alta a la Empresa Revendedora, y son de uso administrativo/legal (facturación,
contacto comercial). SENSA recibe el nombre y apellido de ese contacto para las Cuentas y usa los
datos de la Empresa Revendedora como fallback de teléfono y dirección cuando el Cliente Final no
los tiene cargados.

### Cliente Final
Usuario que efectivamente consume el servicio IPTV. Es dado de alta por la Empresa Revendedora y
asociado a uno o más Dispositivos dentro de una Cuenta. No tiene relación directa con el Operador
Principal ni con el Proveedor, ni acceso propio al sistema. Su registro incluye un **número de
cliente** interno de IPTVControl, su **DNI real** (dato administrativo de la Empresa Revendedora,
que nunca se envía al Proveedor — distinto del identificador sintético `dni_alta_sensa` que exige
SENSA para la Cuenta) y, opcionalmente, un **ID de cliente en el sistema de gestión
propio de la Empresa Revendedora** (para vincularlo con su CRM/facturación externa). Si la Empresa
Revendedora carga ese ID y ya existe otro Cliente Final activo de esa misma Empresa Revendedora con
el mismo valor, el sistema la avisa antes de confirmar el alta — ver `03_Reglas_de_Negocio.md`,
sección 2.5.

## Entidades (modelo de datos)

### Cuenta (Cuenta SENSA)
Unidad de contratación entre el Operador Principal y el Proveedor. Cada Cuenta tiene **un usuario,
una contraseña y un PIN únicos**, un identificador tipo **DNI** exigido por SENSA para el alta
(generado internamente por el sistema, no un DNI real — ver `03_Reglas_de_Negocio.md`, sección 2),
un **correo de contacto** procedimental derivado del correo de la Empresa Revendedora, y una
capacidad comercial que depende de su modo: **exclusiva** (hasta 3 fijos + 3 móviles para un único
Cliente Final) o **compartida** (3 cupos por categoría, repartidos entre ventas 1+1 o 2+2). La contraseña
de la Cuenta tiene exactamente **8 dígitos numéricos** y el PIN, **6 dígitos numéricos**. Es la
unidad que se **factura** del Operador Principal a la Empresa Revendedora, según la modalidad
comercial vigente de esa Empresa Revendedora.

Una Empresa Revendedora puede dar de alta un Cliente Final mediante una **Cuenta completa
exclusiva**, que pertenece a ese Cliente Final e incluye todos los servicios contratados, o mediante
una **venta compartida** (`dispositivo_compartido`) que reserva 1 fijo + 1 móvil o 2 fijos + 2
móviles. Estas ventas comparten Cuenta únicamente cuando tienen idéntica firma de servicios y sus
cupos caben dentro del máximo 3+3. La capacidad de cada modalidad la hace cumplir SENSA mismo, a través de sus
contadores nativos `auto_provision_count_mobile`/`auto_provision_count_stationary`, que IPTVControl
mantiene sincronizados con la cantidad de cupos comprometidos (ver `03_Reglas_de_Negocio.md`,
sección 2.2).

### Dispositivo
Unidad de gestión interna de la Empresa Revendedora. Representa un dispositivo físico (TV o móvil)
vinculado a un Cliente Final específico, dentro de una Cuenta determinada. **No tiene precio propio
en el sistema** — es la Empresa Revendedora quien define, por fuera de IPTVControl, cuánto le cobra
a cada Cliente Final por su Dispositivo.

El formulario de alta no pide tipo ni MAC. Al primer login, SENSA reporta el **ID**, la **MAC** y el
**tipo** del equipo; IPTVControl detecta candidatos durante 10 minutos, con sondeo cada 30 segundos.
En una venta compartida se pueden vincular hasta 1+1 o 2+2 candidatos al mismo Cliente
Final; en una Cuenta completa, hasta 3 fijos + 3 móviles al mismo Cliente Final. Un candidato que
exceda el cupo de su categoría queda como incidencia pendiente de revisión manual (nunca se elimina
solo). Sobre el Dispositivo vinculado, la Empresa Revendedora puede agregar una **nota descriptiva
propia** (ej. "TV living"), dato interno que no se envía a SENSA.

Un Dispositivo puede estar, entre otros, en estado **bloqueado por suspensión**: liberado de la
Cuenta en SENSA pero reservado, sin poder asignarse a otro Cliente Final mientras el Cliente Final
titular siga suspendido (ver `03_Reglas_de_Negocio.md`, sección 3).

### Relación Cuenta – Dispositivo – Cliente Final
Una Cuenta completa pertenece a un único Cliente Final, que puede vincular hasta 3 fijos + 3
móviles. Una Cuenta compartida aloja ventas de idéntica firma de servicios que reservan 1+1 o 2+2,
sin superar sus 3 cupos por categoría. **Punto crítico de diseño (riesgo de negocio
aceptado):** los Clientes Finales que comparten Cuenta reciben las mismas credenciales de acceso,
sin saberlo entre sí, y el sistema no rota la contraseña cuando ingresa una venta nueva después de
una baja definitiva — ver riesgo aceptado en `03_Reglas_de_Negocio.md`, sección 6.

### Modalidad Comercial
Esquema bajo el cual una Empresa Revendedora compra Cuentas al Operador Principal. Ver detalle
completo en `03_Reglas_de_Negocio.md`. Una Empresa Revendedora opera bajo una sola modalidad a
la vez; el cambio de modalidad (downgrade **o upgrade** de escala) es potestad exclusiva del
Operador Principal — depende 100% del trato comercial pactado entre ambos, no es una elección
libre de la Empresa Revendedora.

### Team Member (Miembro del equipo)
Entidad de **acceso técnico al sistema** — no es un actor de negocio como los de la sección
anterior, sino el concepto de "login con permisos" que le da a una persona la posibilidad de
entrar a alguno de los paneles (Operador Principal o Empresa Revendedora). Se agrega este término
para eliminar la ambigüedad de la palabra genérica "usuario", que en IPTVControl podría confundirse
con el Cliente Final (quien, recordemos, **no tiene acceso propio al sistema**). Ver también
`IPTVControl_URL_Routing_Convention.md`, sección 4.3, para el razonamiento completo detrás de este
nombre.

Cada Team Member pertenece **a uno solo** de los dos tenants posibles (Operador Principal o una
Empresa Revendedora puntual, nunca ambos) y tiene un **rol**:

- `operator_admin` — Team Member del Operador Principal con permisos totales (alta de Empresas
  Revendedoras, modalidades comerciales, configuración del Proveedor, etc.).
- `operator_staff` — Team Member del Operador Principal con permisos acotados (reservado a
  futuro; **en el MVP todo Team Member del Operador Principal es `operator_admin`**, no hay
  sub-roles todavía — ver `03_Reglas_de_Negocio.md`, sección 4).
- `reseller_admin` — Team Member de una Empresa Revendedora puntual. **En el MVP es el único rol
  posible del lado Empresa Revendedora** (un solo usuario/login por Empresa Revendedora, sin
  sub-roles internos).
- `reseller_staff` — reservado a futuro, para cuando una Empresa Revendedora necesite dar de alta
  a más de una persona de su equipo con permisos distintos (ej. ventas vs. soporte).

**Primer Team Member root:** el primer `operator_admin` (el de Tecnología Activa como primer
Operador Principal) **no se da de alta a través del panel**, porque todavía no existiría nadie con
permisos para crearlo — es un problema clásico de "arranque en frío". Se provisiona mediante un
seed/script ejecutado una única vez al desplegar el sistema, para que Bruno pueda iniciar sesión
apenas termine el desarrollo y configurar el resto (Proveedor, modalidades comerciales,
`dni_inicial_sensa`, etc.) sin depender de que alguien más lo dé de alta primero. Detalle técnico
del mecanismo en `04_Esqueleto_Tecnico_Inicial.md`, sección 4.6.

## Tabla resumen

| Actor / Entidad | Quién lo crea | Quién lo administra | Visible para |
|---|---|---|---|
| Proveedor (SENSA) | — (externo) | Operador Principal (vía contrato) | Operador Principal |
| Operador Principal | — (dueño del sistema) | Sí mismo | Todos (nivel superior) |
| Empresa Revendedora | Operador Principal | Sí misma (panel propio) | Operador Principal (por ID, soporte) |
| Cliente Final | Empresa Revendedora | Empresa Revendedora | Solo su Empresa Revendedora |
| Cuenta | Sistema, vía API a SENSA | Operador Principal (parametrización) / Empresa Revendedora (uso) | Empresa Revendedora dueña + Operador Principal |
| Dispositivo | Empresa Revendedora, vía API a SENSA | Empresa Revendedora | Solo su Empresa Revendedora |
| Team Member | Seed inicial (el primer `operator_admin`) / Operador Principal (resto) | Sí mismo (cambio de password, etc.) | Solo su propio tenant (Operador Principal o su Empresa Revendedora) |
