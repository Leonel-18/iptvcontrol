# Guía de demostración y onboarding — IPTVControl

> Material para una videollamada de capacitación inicial con una Empresa Revendedora
> que va a empezar a operar. Verificada contra el código real (backend NestJS, frontend
> React, schema Prisma y docs del repo).
> Cómo leer: cada afirmación operativa está clasificada **[CONFIRMADO]**, **[DEPENDE DE CONFIGURACIÓN]**,
> **[NO ENCONTRADO]** o **[PENDIENTE DE DEFINICIÓN]** cuando no pudo verificarse al 100%.

---

## 1. Objetivo

Que un empleado nuevo de una Empresa Revendedora entienda en una sesión:

1. Cómo imaginarse la estructura del sistema (Empresa → Cuenta → Cliente → Dispositivo).
2. Qué hace cada día: ver cuentas, dar de alta clientes, controlar dispositivos, leer estados.
3. Cuáles son los límites que gobiernan su operación (total vs. mensual) y cómo leerlos.
4. Qué NO se debe prometer (funcionalidades inexistentes o pendientes).

No es una sesión técnica. Es una sesión de uso.

---

## 2. Público objetivo

- **Empresa Revendedora** que comienza a operar (un empleado de esa empresa).
- No requiere conocimientos técnicos. Requiere entender el negocio: venden acceso IPTV
  por Cuenta y cada Cuenta agrupa Clientes Finales con sus Dispositivos.
- El que demuestra (vos) es el **Operador Principal** (o su representante) **[CONFIRMADO: rol operator_admin]**.

---

## 3. Modelo mental del sistema

### 3.1 El concepto central es la CUENTA

En SENSA (el proveedor) una Cuenta es un usuario con su contraseña que permite mirar TV.
IPTVControl administra esas Cuentas y a quién se las vende.

Estructura real **[CONFIRMADO en schema + endpoints]**:

```
OPERADOR PRINCIPAL (Tecnología Activa)
  └── EMPRESA REVENDEDORA   (p. ej. "ISP Centro")
        ├── CUENTA A (compartida)
        │     ├── Cliente 1  → Dispositivos (fijo/móvil) autorizados por su venta (1+1 o 2+2)
        │     └── Cliente 2  → Dispositivos...
        ├── CUENTA B (compartida)
        │     └── Cliente 3 → ...
        └── CUENTA C (exclusiva)
              └── Cliente único → hasta 3 fijos + 3 móviles
```

Reglas que definen esta estructura **[CONFIRMADO]**:

- **Cuenta exclusiva**: pertenece a UN solo Cliente Final. Admite hasta **3 fijos + 3 móviles**
  (6 equipos en total) para ese único cliente.
- **Cuenta compartida**: puede tener varios Clientes Finales, pero solo si cada uno entra
  como una **venta 1+1 o 2+2** y todos usan la **misma configuración de servicios**. El máximo
  de la Cuenta compartida es **3 cupos por categoría** (puede alojar: tres ventas 1+1; o una 2+2 y una 1+1).
- Un Cliente Final puede tener dispositivos en más de una Cuenta si una venta adicional no
  entra en la Cuenta actual.
- Todos los Clientes Finales de una **misma Cuenta compartida comparten el mismo usuario y
  contraseña** de esa Cuenta (riesgo aceptado de negocio; no se rota automáticamente).

### 3.2 Quién ve qué

**[CONFIRMADO]** Cada Empresa Revendedora opera **solo dentro de su propia información**:
no puede ver clientes, cuentas, precios ni volúmenes de otra empresa. El Operador Principal
ve la información de todas sus empresas, pero **por ID técnico**: sin nombres de clientes,
sin credenciales, sin notas. Esto es intencional (regla de negocio 4.2) porque el Operador
también vende IPTV y no debe conocer la cartera del revendedor.

---

## 4. Roles y permisos

### 4.1 Actores reales **[CONFIRMADO en enums + guards]**

| Actor | Rol técnico | Qué puede hacer | Qué NO puede | Observaciones |
|---|---|---|---|---|
| Operador Principal | `operator_admin` | Crear/editar empresas y sus datos, asignar modalidad y límites, ver cuentas/dispositivos por ID, reportes, auditoría, importar cuentas externas, configurar SENSA | Ver credenciales de cuentas; ver nombre/contacto/MAC/nota de clientes; editar cuentas de la empresa; operar dispositivos/clientes | El MVP no usa sub-roles (`operator_staff` reservado) |
| Empresa Revendedora | `reseller_admin` | Su panel completo: cuentas, clientes, dispositivos, credenciales, ventas 1+1/2+2, estados, exportar | Ver datos de otras empresas; cambiar su modalidad o su propio límite; gestionar proveedores/configuración SENSA | Un solo rol en el MVP |
| Empleado de una Empresa Revendedora adicional | (rol futuro) | Hoy solo se crea `reseller_admin` | — | El backend permite invitar más miembros; la UI hoy solo ofrece `reseller_admin` **[CONFIRMADO UI; NO ENCONTRADO el uso de staff]** |
| Cliente Final | — | **No tiene acceso al sistema**. Es un registro que la Empresa administra | No entra al panel | Recibe las credenciales por WhatsApp u otro canal |

### 4.2 Aislamiento (cómo se explica)

- **Cada empresa ve solo lo suyo.** Si abren dos empresas en la misma máquina y con el mismo
  navegador, cada una ve su propio entorno (RLS en base de datos) **[CONFIRMADO]**.
- **El Operador NO ve nombres ni datos de contacto de los clientes de la empresa**; ve
  números de cliente, IDs de cuenta y dispositivos (soporte técnico por ID) **[CONFIRMADO]**.
- La empresa suspendida no puede ingresar; el usuario suspendido (Team Member inactivo) tampoco **[CONFIRMADO]**.

---

## 5. Preparación antes de la llamada

### 5.1 Checklist

- [ ] Confirmar que tu empresa de prueba tiene un usuario `reseller_admin` activo (invitación aceptada).
- [ ] Definir una **Empresa DEMO** con modalidad asignada y precio cargado (el seed deja precio en 0; hay que cargarlo) **[CONFIRMADO: seed precio 0, a cargo del Operador]**.
- [ ] Cargar una o dos **Cuentas**: una compartida y una exclusiva.
- [ ] Crear un **Cliente de prueba** (datos ficticios claros: "Juan Prueba").
- [ ] Elegir una **Cuenta compartida vacía** para demostrar el alta de un cliente 1+1 con 0 dispositivos (ver 2 pendientes).
- [ ] Verificar límites: `cuentas_max_crear_mensual`, cuentas actuales y creadas del mes (se ven en el wizard vía panel de límites) **[CONFIRMADO: AccountLimitsPanel usa /resellers/me]**.
- [ ] Tener cargados servicios (catálogo) y verificar que el paquete básico (código 1) esté marcado.
- [ ] Si mostrás credenciales: asegurate de estar en el panel de la Empresa Revendedora (el Operador no puede verlas).
- [ ] Datos SENSA listos si vas a mostrar "Consultar dispositivos en el proveedor" (no modificar cuentas reales de clientes).
- [ ] Plan de contingencia: si no hay dispositivo real para conectar, mostrar el concepto con la pestaña "Pendientes" y explicar el flujo de vinculación.

### 5.2 Datos de demostración sugeridos

```
Empresa demo : ISP Centro
Modalidad    : Menudeo (o X5 si mostrás compromiso)
Cuenta demo  : "Cuenta Sucursal Centro" (compartida, vacía, sin clientes)
Cliente 1    : Juan Prueba (DNI ficticio 99.000.001)
Venta        : 1 + 1  (autoriza 1 fijo + 1 móvil)
Estado inicial esperado: 0 dispositivos reales → la UI muestra 2 "pendientes"
Servicios    : Básico (1) y un extra marcado (ej. 3)
```

Para explicar 2+2 podés usar un segundo cliente o editar la reserva del primero a 2+2
(botón selector en la pestaña Clientes) y ver cómo "Pendientes" pasa a 4.

---

## 6. Guion recomendado (orden sugerido para compartir pantalla)

Un recorrido que sigue el modelo mental y evita mostrar todo junto:

1. Login (qué usuario, dónde se entra).
2. Dashboard (qué indica cada número).
3. Estructura: ir a Cuentas y abrir una compartida (vista por cuenta).
4. Explicar 1+1 / 2+2 y "pendientes" con la Cuenta vacía.
5. Dar de alta un cliente (wizard).
6. Ver el resultado en la Cuenta: venta, reserva editable, pendientes.
7. Consultar al proveedor / entender dispositivos (si hay equipo real o no).
8. Ver estados de un cliente (activo/suspendido/baja) sin ejecutar acciones destructivas.
9. Explicar límites (panel arriba del wizard y en la ficha de cuenta).
10. Errores comunes y cómo leerlos.
11. Cerrar con FAQ mínima y "qué NO prometer".

Detalle de cada paso abajo (sección 7).

---

## 7. Demo paso a paso (lo que mostrás, decís, remarcás, evitás)

### 7.1 Login

- **Mostrar**: pantalla de inicio → botón Ingresar → página de Auth0 → volver al panel.
- **Decir**: "Cada persona de tu empresa tiene su propio acceso. Vos entrás desde cualquier
  navegador/computadora. El sistema te identifica y te muestra SOLO la información de tu empresa."
- **Remarcar**: si te cae la sesión, volvés a ingresar con tu correo/contraseña.
- **Evitar**: explicar OAuth/JWT/Auth0.

### 7.2 Dashboard

- **Mostrar**: panel de la Empresa Revendedora (Inicio). Card "Cuentas cerca del límite",
  métricas (Clientes activos, Cuentas activas, Dispositivos activos/disponibles), "Su modalidad
  comercial" y "Próximos pasos" **[CONFIRMADO: Dashboard.tsx PanelRevendedora]**.
- **Decir**: "Este es tu resumen diario: cuántos clientes tenés, cuántas cuentas, y si alguna
  está por llegar a su límite. Acá también ves qué plan/precio te aplica el Operador."
- **Remarcar**: la Cuenta es "la unidad que te factura el operador" (texto del propio sistema).
- **Evitar**: KPI del Operador y panel de salud de SENSA (no corresponde a la empresa).

### 7.3 Estructura — ir a Cuentas y abrir una compartida

- **Mostrar**: menú Cuentas → listado → abrir una compartida.
- **Decir**: "Una Cuenta es como una 'caja' que tiene su usuario y contraseña en el proveedor.
  Dentro de esa caja vas a poner clientes. Si la Cuenta es compartida, varios clientes usan esa
  misma caja con la misma clave."
- **Remarcar**: en la parte superior ves el tipo (exclusiva/compartida) y la ocupación
  ("Cupos 1+1: X de 3"). Si dice "Cuenta importada: contraseña pendiente", hay que cargar la
  contraseña antes de usar.
- **Evitar**: hablar de customer_id/DNI técnicos del proveedor; llamar "usuario" al cliente.

### 7.4 Concepto 1+1 / 2+2 y "pendientes"

- **Mostrar**: pestaña Clientes de la Cuenta compartida; si hay una venta sin dispositivos,
  la columna "Pendientes".
- **Decir**: "Cuando vendés una entrada '1+1' estás autorizando UN equipo fijo (una TV) y UN
  equipo móvil (celular/tablet/PC) para ese cliente. '2+2' autoriza dos y dos. La columna
  Pendientes te dice cuántos equipos faltan por cargar respecto de lo que vendiste. Si vendiste
  1+1 y todavía no conectó nada, te muestra 2 pendientes — pero todavía NO existe ningún equipo
  registrado en el sistema ni en el proveedor."
- **Remarcar**: un "pendiente" no es un registro real; es una cuenta por cubrir.
- **Evitar**: "fijo = stationary", "móvil = cloud_client" (detalles técnicos).

### 7.5 Alta de cliente (wizard)

- **Mostrar**: Clientes → Nuevo cliente. Recorrer los 4 pasos.
- **Decir**: paso por paso:
  1. Datos del cliente (nombre, DNI, teléfono/correo opcionales, ID de gestión de tu CRM si querés).
  2. Método: exclusiva (una cuenta solo para él) o compartida (entra en una cuenta con otros).
  3. Servicios (el paquete básico queda siempre incluido).
  4. Confirmar y ver qué va a pasar.
- **Remarcar**: si ponés un "ID en tu sistema de gestión" que ya existe, el sistema te avisa y
  te deja elegir "agrupar" (sumar equipo al cliente ya cargado) o "crear de todos modos" **[CONFIRMADO: flujo duplicado id_gestion_externo]**.
- **Evitar**: explicar SENSA; decir "migra sus dispositivos" si no estás seguro (ver sección 25 — texto ambiguo).

### 7.6 Resultado en la Cuenta

- **Mostrar**: la Cuenta elegida → pestaña Clientes → la venta nueva con su reserva (1+1) y
  Pendientes (2).
- **Decir**: "Ya quedó la venta reservada. El cliente todavía no tiene equipos; por eso figuran
  pendientes. Cuando el cliente conecte su equipo, aparece como Dispositivo real."
- **Remarcar**: la reserva se puede ajustar (1+1 a 2+2) desde acá si el cliente necesita más
  espacio, siempre que la Cuenta tenga cupos libres.

### 7.7 Consultar dispositivos en el proveedor / vincular

- **Mostrar**: pestaña Dispositivos → "Consultar dispositivos en el proveedor".
- **Decir**: "El proveedor no avisa solo cuando alguien conecta un equipo; el sistema le
  pregunta. Acá ves qué equipos reportó el proveedor. Los que no están asociados a ningún
  cliente aparecen para que los asignes ('Agregar a...') o los elimines si no corresponden."
- **Remarcar**: un equipo desconocido NUNCA se borra solo: queda como incidencia para que la
  empresa lo resuelva manualmente **[CONFIRMADO: inventario no elimina solo]**.
- **Evitar**: hacer este paso si no hay un equipo real disponible; usá la explicación conceptual.

### 7.8 Estados de cliente

- **Mostrar**: ficha de un cliente → acciones "Suspender / Reactivar / Dar de baja".
- **Decir**: "Suspender congela el servicio y reserva sus dispositivos. No se los puede
  reasignar mientras siga suspendido. La única forma de liberar esa capacidad es pasar a baja
  definitiva."
- **Remarcar**: dar de baja es irreversible para ese cliente; y por decisión de negocio, si
  alguien más entra después en una cuenta compartida, recibe las MISMAS credenciales (no se
  rota la contraseña).
- **Evitar**: ejecutar una baja en datos reales durante la demo (usar cliente de prueba).

### 7.9 Límites

- **Mostrar**: panel arriba del alta de cliente ("Límite de cuentas / Cuentas actuales /
  Disponibles" y mensual).
- **Decir**: "Tenés DOS números que no hay que confundir: el total de cuentas que podés tener
  en el momento, y las que podés crear por mes. El sistema te los muestra antes de crear para
  que no te enteres recién cuando intentás y falla."
- **Remarcar**: ver sección 14 para la explicación completa.

### 7.10 Errores y mensajes

- **Mostrar**: un ejemplo controlado (no real): intentar bajar una reserva 2+2 a 1+1 cuando el
  cliente ya cargó dos equipos de una categoría, o un límite alcanzado.
- **Decir**: "Los avisos importantes aparecen dentro del formulario (no solo en la notificación
  que pasa rápido). Leelos: casi siempre te dicen qué corregir."
- **Remarcar**: cuando aparece "sistema congestionado, comuníquese con el operador" significa
  que el proveedor no respondió; no se perdió la información.

### 7.11 Cierre

- **Decir**: "Hoy alcanza con esto. Cuando uses el sistema en serio vas a ver los estados,
  los límites y los pendientes y todo va a tener sentido. Te dejo una guía de preguntas
  frecuentes."
- **Remarcar**: "No todo está disponible todavía; si algo no se puede hacer, te lo vamos a
  decir antes de prometerlo."

---

## 8. Demo de 15 minutos (rápida)

Solo lo imprescindible:

1. Login (1 min).
2. Dashboard (2 min).
3. Cuentas → abrir compartida y explicar estructura (3 min).
4. Explicar 1+1/2+2 y pendientes con la cuenta vacía (3 min).
5. Alta de cliente rápida (3 min).
6. Resultado: venta + pendientes (2 min).
7. Límites (1 min).
8. FAQ top 3 (después de la llamada, por escrito).

---

## 9. Demo de 30–45 minutos (recomendada)

Todo lo de la sección 7 con calma + ejemplos:

1. Login + Dashboard (4 min).
2. Estructura (Cuentas → compartida) y modelo mental (5 min).
3. 1+1/2+2 y pendientes (5 min).
4. Alta de cliente wizard completa (7 min).
5. Resultado + reserva editable (4 min).
6. Consultar proveedor/dispositivos (5 min, conceptual).
7. Estados de cliente: suspender/reactivar (concepto, 4 min).
8. Límites total vs. mensual (4 min).
9. Errores y qué hacer (3 min).
10. FAQ + cierre (4 min).

---

## 10. Demo de 60 minutos (completa)

Todo lo anterior +:

- Pestaña dispositivos en detalle: fila "Pendiente"/"Esperando primer inicio", "Corregir
  vinculación", "Agregar a", "Eliminar" (10 min extra).
- Cuenta exclusiva vs. compartida y cuándo usar cada una (5 min).
- Exportar a CSV (clientes/dispositivos/cuentas) (3 min).
- Configuración propia: Ventana de Alta y Plantilla de WhatsApp (5 min).
- Preguntas difíciles y casos especiales (10 min).
- Repaso del modelo y preguntas abiertas (5 min).

---

## 11. Funcionalidades principales (qué existe, verificado)

- Panel separado por rol; menú distinto entre Operador y Empresa Revendedora **[CONFIRMADO: AppLayout]**.
- Cuentas: listado, detalle, credenciales (revendedora), contenido habilitado, ocupación,
  reserva editable, sincronizar contenido, consultar dispositivos, cambiar contraseña.
- Clientes: alta wizard, listado, ficha, búsqueda, CSV, estados (activo/suspendido/baja).
- Dispositivos: listado/detalle, alta contextual, vinculación automática por primer login,
  corrección de vinculación, reasignación, incidencias.
- Planes comerciales: el Operador los administra; la empresa ve "sus precios vigentes".
- Reportes de consumo (Operador) para facturación externa.
- Auditoría: historial con quién/cuándo (ambos roles; la empresa ve solo lo suyo).
- Configuración: empresa → Ventana de Alta + Plantilla de WhatsApp; Operador → conexión
  SENSA + proveedores.
- Importación de cuentas externas (Operador, compartidas por defecto).

---

## 12. Cuentas

### 12.1 Qué es una Cuenta **[CONFIRMADO]**

- Unidad de contratación/facturación entre Operador y Empresa Revendedora.
- En el proveedor es un usuario con usuario+contraseña+PIN.
- Exclusiva: un solo Cliente Final, hasta 3 fijos + 3 móviles.
- Compartida: hasta 3 cupos por categoría con ventas 1+1 o 2+2 (clientes distintos, misma
  firma de servicios).

### 12.2 Qué ve el usuario en la ficha de Cuenta

- Tipo, estado, ocupación ("Cupos 1+1"), contenido habilitado, credenciales (botón "Ver
  credenciales"), clientes y sus ventas con reserva y pendientes, dispositivos, y Ventana de
  Alta si es compartida.

### 12.3 Reglas que conviene explicar

- **Cambio de tipo**: una Cuenta exclusiva NO se puede convertir en compartida. Una compartida
  puede pasar a exclusiva solo si tiene a lo sumo un cliente **[CONFIRMADO en código]**.
  Ojo: la documentación vieja dice lo contrario (contradicción — ver sección 25).
- **Cerrar cuenta**: no hay botón de cierre en la interfaz actual **[CONFIRMADO: sin UI]**.
  No prometas "podés cerrar una cuenta" como una acción del panel.
- **Cuenta importada**: queda compartida por defecto y NO acepta clientes hasta cargar la
  contraseña real y conciliar dispositivos pendientes **[CONFIRMADO]**.

### 12.4 Pregunta típica

- "¿Puedo borrar una cuenta que ya no uso?" → Hoy no hay botón de cierre en el panel. Si es
  indispensable, es una gestión del Operador (ver sección 18 para clasificación exacta).

---

## 13. Clientes

- Alta por dos métodos: **Cuenta exclusiva** o **venta en Cuenta compartida** (1+1/2+2).
- Se pide nombre, DNI, teléfono/correo/dirección opcionales, e "ID en su sistema de gestión"
  (opcional, para conectar con su CRM).
- Un cliente puede aparecer en más de una Cuenta si necesita más equipos que los que permite
  su venta actual.
- Estados: activo / suspendido / dado de baja.
- **Suspensión**: libera el equipo en el proveedor pero lo reserva; no se puede reasignar a
  otro cliente mientras el titular siga suspendido.
- **Baja definitiva**: única forma de liberar esa capacidad. Irreversible. La contraseña de la
  Cuenta NO se rota automáticamente (riesgo aceptado).
- Errores esperables: "ya completó su venta", "no tiene una venta en esta Cuenta",
  "cuenta exclusiva ya tiene un cliente".

---

## 14. Límites (sección central)

### 14.1 Cuáles existen

| Límite | Qué controla | Dónde se ve | Qué pasa si se alcanza |
|---|---|---|---|
| **Cuentas máximas (total)** | Cuántas cuentas puede tener la empresa en total | Tabla del Operador (col. "Cuentas máximas"); en el wizard del alta (panel de límites) | El alta se rechaza con aviso |
| **Máx. crear / mes** (`cuentas_max_crear_mensual`, default 10) | Cuántas cuentas nuevas puede crear en el mes | Wizard (panel), edición de empresa del Operador | El alta se rechaza con "alcanzó su máximo de N cuentas nuevas en el mes" **[CONFIRMADO: LimiteCreacionMensualError]** |
| **Cuentas a cobrar** | Cuántas cuentas le corresponderá facturar según su modalidad | Tabla del Operador | Es informativo para conciliación |
| **Cupos por Cuenta compartida** | 3 cupos por categoría | Ficha de Cuenta | No entra una venta nueva que supere 3; pedís otra cuenta |
| **Equipos por venta** | 1+1 o 2+2 por cliente | Ficha de Cuenta/Clientes | No podés cargar más equipos que los autorizados sin ajustar/agregar |
| **Equipos exclusiva** | 3 fijos + 3 móviles por cliente único | Ficha de Cuenta | No se puede agregar más sin otra cuenta |

### 14.2 Cómo se calcula cada número (explicación interna)

- **"Cuentas máximas"** (lo que ve el panel de límites): se calcula como
  `total de cuentas − cuentas creadas este mes + cuentas máx. a crear por mes`.
  Ejemplo real documentado en el código: con 23 cuentas totales, 3 creadas este mes y límite 10 → 30.
- **"Creadas este mes"**: solo cuentan las cuentas creadas por IPTVControl en el mes
  calendario (Argentina). Las importadas NO consumen cupo mensual **[CONFIRMADO]**.
- **"Cuentas actuales"**: activas + cerradas. Nota: al día de hoy no hay botón de cierre en el
  panel, así que en la práctica "actuales" tiende a ser creciente.
- **Cuentas a cobrar**: 
  - obligación mensual (X5/X10) → ritmo × mes de compromiso (el "mes 1" arranca cuando el
    Operador te asignó la modalidad);
  - menudeo → las cuentas activas/creadas del mes.
  **[CONFIRMADO en revendedoras.service]**. Existe además otro cálculo interno para reportes de
  consumo que puede diferir (ver sección 25: dos definiciones de "usadas").
- **Disponibles = Límite − actuales** (nunca negativo).

### 14.3 Ejemplos numéricos para la llamada

```
Límite de cuentas (total): 30
Cuentas actuales: 20
Disponibles: 10

Máx. crear / mes: 10
Creadas este mes: 8
Disponibles este mes: 2
```

Explicar: aunque tengas 10 disponibles totales, este mes solo podés crear 2 más. Cuando
arranque el mes siguiente, el contador de "creadas este mes" vuelve a 0 (y "Disponibles este
mes" vuelve a 10, salvo que el Operador cambie el tope).

### 14.4 Qué pasa si te acercás

- Total: cerca (≤2 restantes) aparece aviso en el panel y en el wizard.
- Mensual: cerca (≤2 restantes) aparece aviso.
- Al alcanzar el total o el mensual, el alta de cuenta se rechaza con un mensaje claro. La
  información queda, no se pierde el cliente que estabas cargando (se cancela el alta).

---

## 15. Estados

### 15.1 De Cuenta
- `activa` / `cerrada` (sin UI de cierre hoy).

### 15.2 De Cliente Final
- `activo` → `suspendido` → `dado de baja` (o reactivación).
- Suspendido: reservado, no reasignable.
- Baja: irreversible, libera capacidad.

### 15.3 De Dispositivo (lo que ve el usuario)
- **Activo**: ocupa su cupo. Puede estar ya vinculado al proveedor o "esperando primer inicio de sesión".
- **Bloqueado por suspensión**: liberado en el proveedor pero reservado para su cliente.
- **Disponible**: sin dueño, listo para reasignar.
- **Dado de baja**: histórico.
- **Vinculación**: Pendiente / Esperando inicio / Vinculado / Revisión necesaria / Vinculación vencida / Cancelado.
  (El estado "ambiguo" aparece en la UI y docs pero el sistema actual no lo asigna — ver sección 25.)

### 15.4 Incidencias de dispositivos del proveedor
- `pendiente / reconocido / eliminación pendiente / resuelto`. El usuario las resuelve
  manualmente ("Agregar a..." = vincular, o "Eliminar").

---

## 16. Errores (qué significan, cómo explicarlos)

| Mensaje que ve el usuario | Qué significa | Qué hacer |
|---|---|---|
| "Intente nuevamente más tarde, sistema congestionado, comuníquese con el operador" | El proveedor no respondió (503) | Esperar y reintentar; avisar al Operador si se repite |
| "Alcanzaste el límite de cuentas..." | Tope total alcanzado | No se puede crear otra cuenta ahora; liberar espacio o pedir ajuste al Operador |
| "Esta Empresa Revendedora alcanzó su máximo de N cuentas nuevas en el mes" | Tope mensual | Esperar al mes siguiente o que el Operador suba el tope |
| "La Cuenta todavía no está habilitada para recibir un Cliente Final nuevo" | Ventana de Alta activa de otro cliente | Esperar a que venza o levantarla manualmente (si corresponde) |
| "Este Cliente Final ya completó su venta N+N" | Cliente con cupos cubiertos | Agregar equipo en otra cuenta compatible |
| "El dispositivo está bloqueado por suspensión y no puede reasignarse" | Suspensión activa | Reactivar el cliente o dar de baja definitiva |
| "El DNI ya está registrado en el proveedor" (exclusiva) | Identidad en uso en SENSA | Verificar el DNI; no se puede cambiar en SENSA |
| "Cuenta importada... contraseña pendiente" | Falta configurar la contraseña | Cargarla desde la ficha de la cuenta |

---

## 17. Preguntas frecuentes (FAQ de la llamada)

Ver archivo `FAQ_OPERADOR_CLIENTE.md` (se entrega al empleado). Acá, las 10 más probables en vivo:

1. ¿Puedo entrar desde cualquier computadora? → Sí, con tu acceso **[CONFIRMADO]**.
2. ¿Cada empleado usa su propio usuario? → Hoy tu empresa tiene un acceso (`reseller_admin`). Se pueden sumar más desde Equipo **[CONFIRMADO UI: TeamMemberForm ofrece reseller_admin]**.
3. ¿Puedo ver clientes de otra empresa? → No **[CONFIRMADO: RLS]**.
4. ¿Cuántas cuentas puedo crear? → Lo muestra el panel de límites; depende de tu tope total y mensual **[CONFIRMADO]**.
5. ¿Qué pasa si llego al límite? → No podés crear más hasta liberar espacio (total) o el mes próximo (mensual) **[CONFIRMADO]**.
6. ¿Por qué un cliente muestra dispositivos "pendientes" si no cargó nada? → Porque son virtuales: marcan cuántos equipos le faltan según su venta **[CONFIRMADO]**.
7. ¿Un pendiente ya existe en el proveedor? → No **[CONFIRMADO: no se crea registro ficticio en venta compartida]**.
8. ¿Puedo eliminar un cliente? → Hay "dar de baja definitiva" (irreversible) **[CONFIRMADO]**.
9. ¿Otra persona puede ver mis contraseñas de cuentas? → Solo usuarios de tu propia empresa con acceso; el Operador NO las ve **[CONFIRMADO]**.
10. ¿Esto me va a servir para facturar? → Se exporta a CSV y el Operador usa reportes de consumo; la facturación la hacés por fuera **[CONFIRMADO: no facturación en el sistema]**.

---

## 18. Preguntas difíciles/incómodas (clasificadas)

Clasificación: **CONFIRMADO EN EL SISTEMA** / **DEPENDE DE CONFIGURACIÓN** / **NO ENCONTRADO** / **PENDIENTE DE DEFINICIÓN**.

1. ¿Por qué funciona así (estructura de cuentas)? → **CONFIRMADO**: la Cuenta es la unidad de facturación del proveedor y del Operador.
2. ¿Por qué no puedo crear más cuentas? → **CONFIRMADO**: tope total/mensual definido por el Operador.
3. ¿Por qué existe límite mensual? → **CONFIRMADO**: control de crecimiento acordado comercialmente.
4. ¿Por qué un dispositivo aparece "pendiente"? → **CONFIRMADO**: es capacidad requerida no cubierta (virtual).
5. ¿Por qué no puedo borrar cierta información? → **CONFIRMADO parcial**: baja de cliente es definitiva; cierre de cuenta sin UI; cambio de DNI no posible en SENSA.
6. ¿Por qué esa función todavía no está disponible? → **PENDIENTE DE DEFINICIÓN** en cada caso; no prometer.
7. ¿Qué pasa si el sistema se cae? → **NO ENCONTRADO**: sin documentación pública de SLA. El frontend avisa "no pudimos conectarnos". El proveedor caído avisa "sistema congestionado".
8. ¿Hay backups? → **NO ENCONTRADO en el repo**: gestionados por infraestructura fuera del desarrollo.
9. ¿Quién puede acceder a mis datos? → **CONFIRMADO**: tu empresa (miembros) y el Operador por ID/soporte; no otra empresa.
10. ¿Existe historial de modificaciones? → **CONFIRMADO**: Auditoría (la empresa ve solo la suya).
11. ¿Puedo exportar mis datos? → **CONFIRMADO**: CSV en clientes, dispositivos, cuentas; reportes del Operador.
12. ¿Puedo utilizar una API? → **PENDIENTE**: API pública con API keys es decisión de arquitectura para fase 2 (no implementada).
13. ¿Eliminar una cuenta libera mi límite? → **CONFIRMADO del cálculo**: no hay UI de cierre; y "cuentas actuales" incluye cerradas/importadas, por lo que no liberaría espacio hoy. **PENDIENTE DE DEFINICIÓN** el modelo de negocio exacto de reutilización.
14. ¿Por qué mis credenciales de cuentas compartidas son iguales para todos los clientes? → **CONFIRMADO**: decisión de negocio (riesgo aceptado, sin rotación automática).
15. ¿Cuál es el plazo de la Ventana de Alta? → **DEPENDE DE CONFIGURACIÓN**: lo define cada empresa (0 = desactivada).

---

## 19. Decisiones de diseño (por qué se hizo así)

### DECISIÓN: Los "pendientes" no se guardan como dispositivos
- **MOTIVO**: un pendiente representa capacidad sin usar, no un equipo real. Se crea registro solo cuando existe un equipo (SENSA lo reporta en el primer login) **[CONFIRMADO: Pieza 4]**.
- **BENEFICIO**: no se ensucia la base con equipos ficticios; el "pendiente" siempre es la diferencia real entre lo vendido y lo cargado.
- **QUÉ EXPLICAR**: "El sistema te muestra 'faltan 2 equipos'. Esos 2 todavía no existen; existen cuando el cliente enciende su TV/celular y el proveedor lo reporta."

### DECISIÓN: Ventas 1+1/2+2 y Cuentas compartidas
- **MOTIVO**: el proveedor da Cuentas con capacidad; compartir una Cuenta con idéntica firma de servicios baja el costo por venta.
- **BENEFICIO**: aprovechás cada Cuenta hasta 3 cupos por categoría.
- **QUÉ EXPLICAR**: "Compartir una Cuenta solo es posible si todos los clientes que están adentro usan exactamente los mismos canales/servicios."

### DECISIÓN: Aislamiento por empresa
- **MOTIVO**: negocio multi-tenant; evitar fugas entre revendedores y proteger al Operador de ver la cartera de sus clientes (regla 4.2).
- **BENEFICIO**: confianza; cada empresa es dueña de su información.
- **QUÉ EXPLICAR**: "Cada empresa vive en su propio entorno. Ni siquiera el Operador ve los nombres de tus clientes."

### DECISIÓN: Contraseña compartida sin rotación
- **MOTIVO**: rotar obligaría a notificar a todos los clientes de la Cuenta; trade-off de soporte.
- **BENEFICIO**: operación más simple.
- **QUÉ EXPLICAR**: "Si un cliente sale y entra otro a la misma Cuenta, el nuevo recibe la misma clave. No se rota automáticamente."

### DECISIÓN: Todo el flujo contra un proveedor real sin modo prueba
- **MOTIVO**: decisión de negocio del Operador (pruebas directas en SENSA con cuentas dedicadas).
- **QUÉ EXPLICAR**: "Las altas se hacen en el proveedor real; por eso las pruebas se hacen con cuentas de prueba, nunca con clientes reales."

### DECISIÓN: Errores importantes dentro del formulario
- **MOTIVO**: UX; el toast puede pasar desapercibido.
- **BENEFICIO**: el usuario ve por qué falló y qué corregir.

---

## 20. Errores comunes en los primeros días

| Síntoma | Motivo | Qué debe hacer | Cómo explicarlo |
|---|---|---|---|
| No me deja crear una cuenta | Límite total/mensual alcanzado | Leer el aviso; esperar o pedir ajuste | "El sistema te avisa antes; es un tope comercial" |
| Confunde "cuentas actuales" con "a cobrar" | Dos conceptos distintos | Ver la leyenda del panel | "Actuales = lo que tenés; a cobrar = lo que te van a facturar según tu plan" |
| Confunde tope total con mensual | Son dos números | Ver panel de límites | "Total = capacidad; mensual = lo nuevo por mes" |
| Cree que un pendiente es un equipo creado | Terminología | Ver pestaña Clientes y dispositivos reales | "Pendiente = falta cubrir, no existe todavía" |
| Intenta duplicar un cliente | No encontró al existente | Buscar por nombre/DNI/ID de gestión | "Usá la búsqueda o el ID de tu CRM; el sistema avisa si se repite" |
| No completa campos obligatorios | Corrió a confirmar | Leer el error del campo en rojo | "El campo marcado es obligatorio" |
| Acción que no puede hacer (botón ausente) | Rol o estado | Ver si corresponde a su rol | "Esa acción la hace el Operador / no aplica en este estado" |

---

## 21. Casos prácticos (ejercicios para el cliente)

1. Crear una venta 1+1 en una Cuenta compartida vacía → ver "2 pendientes".
2. Cambiar la reserva a 2+2 → ver "4 pendientes".
3. Vincular un equipo real reportado por el proveedor → bajan los pendientes.
4. Suspender un cliente → ver equipo "bloqueado por suspensión"; confirmar que no se puede
   reasignar.
5. Reactivar → vuelve a activo con ventana nueva de vinculación.
6. Probar el límite: intentar exceder (no ejecutar en producción real).

---

## 22. Qué NO mostrar inicialmente

- Panel del Operador (empresas, reportes, conexión SENSA, proveedores) salvo que el
  interlocutor sea el Operador.
- Configuración interna de SENSA (token, servidor).
- IDs técnicos internos (UUID), customer_id, endpoints.
- Gestión global de revendedores y cuentas externas.
- Flujo de importación de cuentas externas.
- Detalle de incidencias avanzadas si no hacen falta.
- Cualquier función que la empresa no vaya a usar en el día a día.

---

## 23. Contingencias durante una demo

- **Si falla una creación** → mostrá el aviso, explicá la causa probable (límite, proveedor
  caído, dato duplicado) y reintentá con un dato distinto. No quedes mostrando el error como
  algo anómalo; es parte normal del uso.
- **Si el proveedor está caído** → decí: "El proveedor no respondió; eso es esperable a veces.
  El sistema no perdió nada; reintentamos en un momento." No intentes forzar SENSA.
- **Si aparece un error técnico (500)** → "Ocurrió un error interno; lo anotamos para
  revisarlo." No expliques stack traces.
- **Si no hay equipo físico para conectar** → explicá el concepto con la columna Pendientes y
  el flujo "cuando el cliente conecte, aparece acá".
- **Si un botón esperado no está** → revisá el rol de la sesión o el estado; no improvises
  funciones inexistentes.

---

## 24. Glosario

| Concepto | Explicación |
|---|---|
| Empresa Revendedora | Empresa que compra Cuentas al Operador y las revende a Clientes Finales |
| Cuenta | "Caja" con usuario y contraseña en el proveedor; unidad que se factura |
| Cuenta exclusiva | Cuenta para UN solo cliente (hasta 3 fijos + 3 móviles) |
| Cuenta compartida | Cuenta con varios clientes (ventas 1+1/2+2), misma firma de servicios, máx 3 cupos por categoría |
| Cliente Final | Persona que consume el servicio; NO tiene acceso al sistema |
| Venta 1+1 / 2+2 | Autorización de 1 fijo+1 móvil / 2 fijos+2 móviles para ese cliente |
| Dispositivo fijo | TV (Android TV, Roku, Fire TV, Apple TV...) |
| Dispositivo móvil | Celular, tablet o PC/navegador |
| Dispositivo pendiente | Equipo que "falta cargar" según la venta (virtual, no creado) |
| Sincronización | Preguntarle al proveedor qué equipos tiene realmente |
| Incidencia | Equipo detectado en el proveedor que no pertenece a ninguna venta (se resuelve manual) |
| Ventana de Alta | Periodo en que una Cuenta compartida no recibe OTRO cliente nuevo tras una venta |
| Límite total de cuentas | Máximo de cuentas que la empresa puede tener en un momento |
| Límite mensual de creación | Cuentas nuevas que la empresa puede crear en un mes |
| Cuentas a cobrar | Según modalidad: compromiso mensual (X5/X10) o cuentas activas/creadas (menudeo) |
| Baja definitiva | Acción irreversible que libera la capacidad de un cliente |
| Auditoría | Registro de quién hizo qué y cuándo |

---

## 25. Checklist final (revisión contra el código)

- [ ] Estructura Empresa → Cuenta → Cliente → Dispositivo correcta.
- [ ] Aislamiento entre empresas verificado (RLS).
- [ ] 1+1/2+2 y "pendientes virtuales" explicados como en esta guía.
- [ ] Límites: total y mensual diferenciados con ejemplos.
- [ ] Estados (activo/suspendido/baja; vinculación) claros.
- [ ] Errores: se muestran en formulario y toast.
- [ ] No se prometió: cierre de cuenta desde UI, API pública, backups, SLA, rotación de
      contraseña, cambio de DNI en SENSA.

### Contradicciones detectadas (para no repetir en la demo)

1. **Cambio de tipo exclusiva↔compartida**: la documentación (03 §2.3.1) describe ambos
   sentidos; el **código solo permite compartida→exclusiva** **[CONFIRMADO]**.
2. **"Reservas técnicas"**: docs/UI todavía la mencionan ("la capacidad queda protegida por
   una reserva técnica", tipos con `reserva_tecnica`), pero el **modelo real usa contadores de
   SENSA por venta**; ya no existen dispositivos de reserva **[CONFIRMADO: tabla eliminada]**.
3. **"Ambiguo"**: aparece en UI/docs pero el sistema actual **no lo asigna** (se reemplazó por
   incidencias).
4. **Menudeo "usadas"**: reportes de consumo y "cuentas a cobrar" usan **dos definiciones
   distintas** de "en uso" **[CONFIRMADO en dos servicios]**.
5. **"Migra sus dispositivos"**: un texto del alta al agrupar sugiere migración de equipos;
   la regla documentada dice que **no** se migran **[CONFIRMADO texto; PENDIENTE el flujo]**.
6. **Vencimiento sin equipos en venta compartida**: docs viejas dicen "libera venta"; el
   código **mantiene la venta reservada** (decisión Fase F) **[CONFIRMADO]**.
7. **Botón "Agregar cliente" en exclusiva importada sin titular**: el botón se muestra pero el
   modal solo aplica a compartidas → probable bug de UI **[CONFIRMADO en código; NO probado]**.

---

## 26. Información pendiente de confirmar

- Uso real de `SENSA_DNI_MAX_RETRIES` (se usa el campo por Operador, no la env).
- Si `operator_staff`/`reseller_staff` se pueden invitar hoy por UI (la UI solo ofrece admin).
- Comportamiento exacto del Operador en `/customers` sin empresa seleccionada.
- Contenido exacto y formato del CSV de auditoría según rol.
- Si el umbral de alerta editable en Configuración realmente cambia el aviso del dashboard.
- Regla exacta de liberación de una "venta compartida abandonada" (sin job de limpieza
  encontrado).
- Política de backups y SLA (fuera del repo).
- Cierre de cuenta: confirmar si algún flujo automático lo usa.
- Cadencia de mantenimiento de contraseñas/PIN en cuentas importadas.
