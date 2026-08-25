# IPTVControl — Reglas de Negocio

## 1. Modalidades comerciales

Una Empresa Revendedora opera bajo **una sola modalidad a la vez**. El cambio de modalidad
(downgrade **o upgrade** de escala) es potestad exclusiva del Operador Principal (la Empresa
Revendedora no puede autogestionarlo) — depende 100% del trato comercial pactado entre ambos.

### 1.1. Al menudeo (sin obligación de ventas mensuales)
- Se factura únicamente por Cuentas efectivamente utilizadas.
- Precio por Cuenta según escala de volumen (definida y parametrizada por el Operador Principal;
  ver PDF de referencia "Propuesta Comercial IPTV para ISP" para los valores iniciales de SENSA).

### 1.2. Con obligación de ventas mensuales (escala creciente, ej. X5 / X10)
- La Empresa Revendedora se compromete a un mínimo mensual creciente y acumulativo (ej. plan X5:
  mes 1 = 5 Cuentas facturadas, mes 2 = 10, mes 3 = 15...).
- **El campo de crecimiento (tope, ritmo de incremento) lo parametriza el Operador Principal** —
  no es un valor fijo hardcodeado, ya que puede variar entre distribuidores o entre Proveedores.
- Las Cuentas comprometidas se facturan en su totalidad, se usen o no. La modalidad permite dar de
  alta **más Cuentas de las facturadas** ese mes — simplemente se facturan las que correspondan
  según la escala vigente (ej. plan X5, mes 1: se factura 5, pero se habilitan hasta 20 activas).
- **Cuentas no vendidas/usadas en un mes no se pierden**: quedan disponibles para el mes siguiente.
  Es responsabilidad de la Empresa Revendedora venderlas y usarlas.
- **Downgrade de escala** (ej. de X10 a X5) **o upgrade** (ej. de X5 a X10): en ambos casos, solo
  puede ejecutarlo el Operador Principal, según lo pactado comercialmente con la Empresa
  Revendedora.

### 1.3. Precios
- Los precios los establece el **Operador Principal** (parametrizables, no hardcodeados — sujeto a
  actualización por IPC según la propuesta comercial de referencia).
- La **Empresa Revendedora define sus propios precios** hacia el Cliente Final; el sistema no
  interviene en esa facturación, pero sí debe mostrarle a la Empresa Revendedora los precios
  vigentes que le corresponden a ella según su escala/modalidad.

## 2. Ciclo de vida de una Cuenta

### 2.1. Dos métodos de alta de Cliente Final
Al dar de alta un Cliente Final nuevo, la Empresa Revendedora elige entre:
1. **Cuenta completa exclusiva**: el sistema siempre crea una Cuenta nueva en SENSA para ese
   Cliente Final, sin buscar espacio en Cuentas existentes. La Cuenta pertenece a ese único cliente,
   incluye todos los servicios contratados y permite registrar hasta **3 Dispositivos fijos + 3
   móviles** (hasta 6 Dispositivos en total, sin relación entre sí).
2. **Venta unitaria** (`dispositivo_compartido`): autoriza hasta **1 Dispositivo fijo + 1 móvil**
   para ese Cliente Final ("fijo" = TV/`stationary`; "móvil" = celular, tablet o PC por navegador
   `cloud_client` — confirmado por Bruno el 24/08/2026, caso Valentín Alamo). En el wizard la
   Empresa Revendedora elige los servicios de esa venta; el
   servicio básico código 1 está siempre incluido. El sistema calcula una firma canónica de
   servicios y solo comparte Cuenta con otras ventas de firma idéntica. Una Cuenta compartida aloja
   como máximo **3 ventas** (hasta 6 Dispositivos en total, 2 por venta).
3. El formulario no solicita tipo ni MAC: SENSA los informa al primer login de cada equipo.

### 2.2. Bloqueo de capacidad vía contadores de SENSA y descubrimiento del Dispositivo

- **Mecanismo de bloqueo (reemplaza el modelo anterior de "Dispositivos de reserva técnicos"):**
  SENSA expone en cada Cuenta dos contadores por categoría —
  `auto_provision_count_mobile` y `auto_provision_count_stationary` — que limitan cuántos
  Dispositivos de esa categoría puede auto-provisionar la Cuenta. IPTVControl mantiene esos
  contadores sincronizados con la cantidad de **ventas activas** de la Cuenta: una Cuenta compartida
  nueva arranca en 1/1 (su primera venta); al sumarse una 2ª venta compatible, sube a 2/2 **antes**
  de abrir su ventana de vinculación; al darse de baja o suspenderse la última venta de un cliente,
  baja de nuevo (nunca por debajo de 1 mientras la Cuenta esté activa). Una Cuenta exclusiva nace
  fija en 3/3 y no varía con las altas/bajas de su único cliente.
- Después del primer login del Cliente Final, SENSA informa ID, MAC y tipo. IPTVControl toma una
  instantánea previa, abre una ventana de **10 minutos** y consulta cada **30 segundos** para detectar
  candidatos nuevos.
- En una venta unitaria se pueden vincular hasta 1 candidato fijo + 1 candidato móvil al mismo
  Cliente Final. En una Cuenta completa, hasta 3 fijos + 3 móviles al mismo Cliente Final. Cualquier
  candidato que exceda el cupo de su categoría (para ese cliente, o para la Cuenta si es exclusiva)
  no se vincula: queda como incidencia pendiente de revisión manual, igual que un Dispositivo
  detectado por el barrido de inventario (no requiere el estado "ambiguo" del modelo anterior).
- Si vence la ventana sin ningún candidato para una venta nueva, el Dispositivo vuelve a
  `disponible` y el contador se resincroniza contra las ventas activas reales (baja solo).
- **Límite real de los contadores de SENSA (confirmado por prueba de Bruno, 21/08/2026):** los
  contadores `auto_provision_count*` evitan un alta explícita por API y probablemente los tipos
  "phone"/"stationary", pero **no bloquean** un inicio de sesión por el reproductor web de SENSA
  (`cloud_client`), que auto-provisiona un Dispositivo nuevo aunque la Cuenta esté al tope de sus
  contadores. Por eso la defensa real contra un Dispositivo de más es la **detección activa**, no
  el bloqueo de capacidad en sí: el botón "Consultar al proveedor" de `/accounts/:id` y un barrido
  periódico best-effort comparan el inventario real de SENSA contra lo vendido, y dejan cualquier
  Dispositivo no autorizado como incidencia pendiente de revisión manual — nunca se elimina solo
  (ver `04_Esqueleto_Tecnico_Inicial.md`, sección 4.1, y `05_Decisiones_Pendientes.md`, sección 4).
- **Corrección manual de vinculación equivocada (caso Pepito/Marcelo, definido con Bruno el
  21/08/2026):** en una Cuenta compartida puede pasar que, mientras la ventana de vinculación del
  Cliente Final A está abierta, el Cliente Final B pruebe las credenciales en otro equipo y ese
  equipo quede vinculado a A. SENSA no identifica de quién es cada inicio de sesión, así que
  IPTVControl no puede detectarlo solo: la corrección es siempre una decisión de la Empresa
  Revendedora, desde la pestaña Dispositivos de `/accounts/:id` ("Corregir"), con dos opciones:
  - **Reasignar**: el equipo pasa al Cliente Final real dueño (otro Cliente Final activo de la
    misma Cuenta).
  - **Eliminar**: el equipo no pertenece a nadie y se da de baja en el Proveedor.
  En ambos casos, el Cliente Final afectado recibe automáticamente una ventana de vinculación
  nueva. Cada corrección queda registrada en el Audit Log (`correccion_vinculacion_dispositivo`).

### 2.3. Alta de Dispositivo adicional para un Cliente Final ya existente
La Empresa Revendedora puede sumarle a un Cliente Final que ya tiene Dispositivo(s) uno adicional:
- Si es una Cuenta completa y tiene menos de 3 fijos o menos de 3 móviles, se abre el mismo flujo de
  descubrimiento sin pedir tipo ni MAC.
- Si es una venta unitaria y el cliente todavía no completó su par (1 fijo + 1 móvil) en esa misma
  Cuenta compartida, el Dispositivo adicional se suma ahí mismo, sin crear una venta nueva ni tocar
  los contadores de SENSA (la venta ya estaba contada).
- Si la Cuenta exclusiva ya alcanzó 3 fijos y 3 móviles, o el cliente de una venta unitaria ya
  completó su par, un Dispositivo adicional constituye **una venta nueva**: usa otra Cuenta
  compatible con la misma firma de servicios o crea una Cuenta nueva. No se migran los Dispositivos
  existentes para forzar un cupo imposible en la Cuenta actual.
- La baja de uno de varios Dispositivos de un mismo Cliente Final (sin dar de baja al cliente
  entero) no afecta a los demás Dispositivos de ese cliente ni a su estado general.

### 2.4. Identificador (DNI), credenciales y datos enviados a SENSA
- El identificador que SENSA exige para dar de alta una Cuenta corresponde a un **número de DNI**.
  Como el sistema no gestiona DNIs reales de personas físicas, IPTVControl genera estos números de
  forma autónoma: el **número inicial es parametrizable por el Operador Principal**, y a partir de
  ahí el sistema los va incrementando de a uno en cada alta de Cuenta nueva.
- Si al intentar dar de alta una Cuenta la API de SENSA devuelve un error de **"ID (DNI)
  repetido"**, el sistema debe **sumarle 1 al número e intentar nuevamente**, repitiendo el
  proceso hasta lograr un alta exitosa.
- Como dato de contacto de la Cuenta en SENSA, el **correo electrónico** utilizado debe ser el
  correo registrado por la Empresa Revendedora, **agregándole un número creciente antes de la
  arroba** (ej. `contacto@isp.com` → `contacto1@isp.com`, `contacto2@isp.com`, ...), para
  identificar cada Cuenta de forma única sin que la Empresa Revendedora gestione casillas reales.
- La contraseña generada para la Cuenta tiene exactamente **8 dígitos numéricos** y el PIN,
  exactamente **6 dígitos numéricos**.
- El nombre y apellido reales del Cliente Final permanecen en IPTVControl. SENSA recibe el nombre y
  apellido del contacto de la Empresa Revendedora. El teléfono y la dirección se toman del Cliente
  Final cuando están disponibles y usan los datos de la Empresa Revendedora como fallback.
- `id_gestion_externo` permanece exclusivamente local y nunca se envía a SENSA.

### 2.5. Validación de duplicados por ID de sistema de gestión externo

- El campo `id_gestion_externo` del Cliente Final **sigue siendo opcional** — la Empresa
  Revendedora puede cargarlo o no al dar de alta un Cliente Final.
- Si lo carga, el sistema valida, **dentro del alcance de esa misma Empresa Revendedora** (nunca
  cruzando con otras, por el aislamiento multi-tenant de la sección 4), si ya existe un Cliente
  Final con ese mismo `id_gestion_externo`.
- Si encuentra coincidencia, el sistema **no bloquea el alta ni agrupa automáticamente**: muestra
  una advertencia indicando que ya existe un Cliente Final con ese ID, y le da a elegir a la
  Empresa Revendedora entre:
  - **Agrupar**: continuar el alta como "Alta de Dispositivo adicional para un Cliente Final ya
    existente" (flujo de la sección 2.2), sumando el nuevo Dispositivo al Cliente Final ya
    registrado.
  - **Crear de todos modos**: continuar el alta como un Cliente Final nuevo e independiente, aunque
    comparta el mismo `id_gestion_externo` (ej. si la Empresa Revendedora reutiliza el mismo ID de
    CRM para más de un abonado del mismo grupo familiar).
- **Incluido en el alcance del MVP**, por ser parte del flujo básico de alta de Cliente Final.

## 3. Ciclo de vida de un Cliente Final / Dispositivo

- **Alta:** la Empresa Revendedora da de alta al Cliente Final por alguno de los dos métodos de la
  sección 2.1. No elige tipo ni informa MAC.
- **Identificación del Dispositivo:** al primer login se capturan el ID, la MAC y el tipo reportados
  por SENSA mediante el sondeo definido en la sección 2.2.
- **Baja definitiva:** la Empresa Revendedora marca manualmente la baja del Cliente Final. La
  sistema elimina el Dispositivo asociado. En una Cuenta compartida, la capacidad comercial que
  deja la venta se protege con una reserva técnica hasta una venta nueva de idéntica firma de
  servicios. No se reasigna el Dispositivo eliminado ni se reutiliza su MAC. *(Incluido en el
  alcance del MVP.)*
- **Suspensión:** la Empresa Revendedora marca manualmente la suspensión del Cliente Final. El
  sistema elimina el Dispositivo asociado en SENSA y lo mantiene localmente como
  `bloqueado_por_suspension`. Su capacidad comercial queda reservada para ese Cliente Final y no se
  ofrece a otra venta mientras exista la posibilidad de reactivación.
  *(Incluido en el alcance del MVP.)*
- **Transición de "suspendido" a "baja definitiva":** es la **única vía** para liberar la capacidad
  comercial bloqueada. La Empresa Revendedora ejecuta esta transición de forma explícita; en una
  Cuenta compartida se crea la reserva técnica correspondiente hasta una venta futura compatible.
  Mientras el Cliente Final siga suspendido, esa capacidad no puede venderse. *(Incluido en el
  alcance del MVP.)*
- **Reasignación de un Dispositivo bloqueado por suspensión sin pasar por baja definitiva:** no
  puede existir. No es un pendiente de roadmap, es una regla de negocio permanente.

## 4. Aislamiento multi-tenant

- Aislamiento **total** entre Empresas Revendedoras: ninguna puede ver clientes, precios, volúmenes
  ni datos de otra, **ni tampoco datos del Operador Principal** — cada Empresa Revendedora solo
  accede a los datos de su propia cuenta.
- El Operador Principal **no necesita ver el detalle operativo** de cada Empresa Revendedora, pero
  sí necesita poder **identificarla por ID** para brindar soporte técnico o atender consultas, sin
  requerir acceso a sus datos sensibles.
- Cada Empresa Revendedora tiene login y panel de administración propio e independiente, a través
  de su **Team Member** (ver `02_Glosario_de_Actores_y_Entidades.md`) con rol `reseller_admin`.
- En esta primera etapa, cada Empresa Revendedora opera con **un solo Team Member** (`reseller_admin`,
  sin sub-roles internos todavía — `reseller_staff` queda reservado a una etapa futura, para cuando
  una Empresa Revendedora necesite dar de alta a más de una persona de su equipo).
- Del lado del Operador Principal, todo Team Member es `operator_admin` en el MVP (sin sub-roles
  `operator_staff` todavía).

### 4.1. Primer Team Member root del Operador Principal

El primer `operator_admin` (correspondiente a Tecnología Activa como primer Operador Principal) no
se da de alta desde el panel — no puede haber "huevo antes que la gallina": nadie tendría permisos
para crearlo. Se provisiona mediante un **seed ejecutado una sola vez al desplegar el sistema**, de
forma que apenas termine el desarrollo, Bruno pueda iniciar sesión con permisos totales y configurar
el resto del sistema (alta del Proveedor, modalidades comerciales, `dni_inicial_sensa`, etc.) sin
depender de que otro Team Member lo dé de alta primero. Ver mecanismo técnico propuesto en
`04_Esqueleto_Tecnico_Inicial.md`, sección 4.6.

### 4.2. Visibilidad del Operador Principal sobre Cuentas y Dispositivos — solo por ID técnico

**Contexto de la decisión:** el Operador Principal (Tecnología Activa) también vende IPTV, por lo
tanto no puede tener visibilidad comercial sobre la cartera de Clientes Finales de sus Empresas
Revendedoras — sería equivalente a que un proveedor mayorista viera la lista de clientes de sus
propios distribuidores. Esta regla reemplaza cualquier noción de "modo soporte con acceso total":
el aislamiento se logra **no exponiendo el dato**, no restringiendo su acceso con permisos.

En el panel del Operador Principal, dentro del detalle de una Empresa Revendedora, la tabla de
Cuentas y el detalle de Dispositivos muestran **únicamente**:

| Campo | Visible para Operador Principal |
|---|---|
| ID interno de la Cuenta (IPTVControl) | Sí |
| ID de Cuenta en SENSA (`proveedor_cuenta_id`) | Sí — necesario para soporte técnico con SENSA |
| Estado de la Cuenta (activa/cerrada) | Sí |
| Ventas/Dispositivos comerciales (conteo global, ej. "2 de 3") | Sí |
| Usuario / contraseña / PIN de la Cuenta en SENSA | **No** |
| ID de Dispositivo en SENSA (`proveedor_device_id`) | Sí |
| Tipo y estado del Dispositivo | Sí |
| `numero_cliente` (correlativo interno de la Empresa Revendedora) | Sí — es un número, no un dato identificable |
| Nombre y datos de contacto del Cliente Final | **No** |
| `nota_descriptiva` del Dispositivo | **No** — es texto libre y podría contener el nombre del cliente igual, aunque el campo "nombre" esté oculto |

Esta tabla de campos permitidos/prohibidos es **normativa**: cualquier endpoint o vista nueva que
exponga datos de Cuenta o Dispositivo al panel del Operador Principal debe respetarla, no solo las
pantallas descriptas en este documento.

## 5. Manejo de errores de integración con el Proveedor (SENSA)

Si la API de SENSA falla o está caída durante una operación (alta de Cuenta, alta/baja de
Dispositivo):
- El sistema debe notificar al usuario con un mensaje claro tipo **"Intente nuevamente más tarde,
  sistema congestionado, comuníquese con el operador"**.
- No se debe dejar la operación en un estado intermedio inconsistente (Cuenta creada en la base
  local pero no en SENSA, o viceversa) — a definir en la etapa técnica el mecanismo exacto
  (transacción, cola de reintentos, rollback).
- Excepción específica: si el error de SENSA es **"ID (DNI) repetido"** durante un alta de Cuenta,
  el sistema no debe mostrar este mensaje de error al usuario — debe manejarlo internamente
  incrementando el DNI en 1 y reintentando (ver sección 2.3).

## 6. Riesgo de negocio aceptado — contraseña compartida sin rotación

**Contraseña compartida entre Clientes Finales de una misma Cuenta:** dado que hasta 3 ventas
unitarias de idéntica firma de servicios pueden compartir el mismo usuario/contraseña de una Cuenta
SENSA, una venta nueva posterior a la baja definitiva de otro Cliente Final recibe las mismas
credenciales de Cuenta que tenía el cliente saliente, **sin que el sistema rote la contraseña**.
Rotar la contraseña en cada nueva venta
evitaría que el cliente saliente siga usando el servicio con la clave vieja, pero también
obligaría a notificar la nueva clave a todos los demás Clientes Finales activos de esa misma
Cuenta — una complejidad operativa y de soporte que, por decisión de negocio de Bruno, **se
decide no afrontar en esta etapa**, como parte del trade-off para lograr mayor rentabilidad.
**Este es un riesgo conocido y aceptado, no una pregunta abierta ni un bloqueante del MVP.** Para
el caso de suspensión, el riesgo no aplica porque el Dispositivo queda bloqueado y no se reasigna
mientras dure la suspensión. **Confirmación final de Bruno:** este comportamiento queda descartado
para siempre como pendiente de "segunda etapa" — el sistema **no** implementa rotación ni
notificación automática de contraseña. Si alguna vez hiciera falta cambiar la contraseña de una
Cuenta puntual, **lo hace Bruno manualmente**, por fuera del sistema.

## 7. Fuera de alcance en la primera etapa (recordatorio)

- Facturación y cobranza.
- Reasignación de un Dispositivo bloqueado por suspensión, salvo que el Cliente Final pase antes
  a baja definitiva (ver sección 3) — regla de negocio permanente, no un pendiente de roadmap.
- Soporte de más de un Proveedor simultáneo.
- Modelo de licenciamiento del software IPTVControl hacia otros distribuidores (**pendiente de
  definición comercial por parte de Bruno**).

## 8. Vistas del panel de la Empresa Revendedora

La Empresa Revendedora puede consultar su información de dos formas dentro de su panel:
- **Vista por Cuenta**: usuario, contraseña y PIN de esa Cuenta en SENSA, su parametrización de
  contenido (paquetes/canales habilitados), y el listado de todos los Clientes Finales y
  Dispositivos relacionados con esa Cuenta.
- **Vista por Cliente**: usuario, contraseña y PIN de la Cuenta a la que pertenece ese Cliente
  Final, la parametrización de contenido, los Dispositivos que se relacionan específicamente con
  ese cliente, y un botón para saltar a la vista completa de la Cuenta.

**Nota técnica (a resolver en etapa técnica, no bloqueante):** como esta vista expone contraseña y
PIN directamente en el panel, conviene definir con Federico cómo se resguardan esos datos —
cifrado en base de datos, control de quién puede verlos, registro de accesos, etc.

## 9. Requisitos transversales de interfaz

- La aplicación debe poder visualizarse en **modo claro y modo oscuro**, en todos los paneles
  (Operador Principal y Empresa Revendedora).

## 10. Sobre el documento de tareas de Federico

**Descartado definitivamente como fuente de referencia.** El desarrollo (manual o vía opencode)
debe tomar como única fuente de verdad estos cuatro documentos del Proyecto más la documentación
oficial de la API de SENSA (`API_Sensa_V4_1_3.pdf`). El documento de tareas que preparó Federico
contradice varias decisiones ya confirmadas (módulo de facturación fuera de MVP, estructura
X5/X10 vs. FULL/RETAIL, baja individual de dispositivo, ausencia del `ProveedorAdapter`) y no debe
usarse para planificar ni ejecutar tareas. Bruno maneja directamente con Federico cualquier
comunicación al respecto.

## 11. Registro de auditoría (Audit Log)

**Incluido en el MVP.** Cada una de las siguientes acciones queda registrada, con **quién** la
ejecutó (`TeamMember`), **cuándo**, y **sobre qué entidad**:

- Alta, suspensión, transición a baja definitiva y reasignación de Cliente Final.
- Alta y baja de Dispositivo, liberación/reposición de reservas técnicas y resolución de altas
  ambiguas.
- Cambio de modalidad comercial o de escala de una Empresa Revendedora (downgrade/upgrade).
- Cambio de precios (parametrización del Operador Principal).
- Cambio de configuración de conexión al Proveedor (servidor, credenciales, `dni_inicial_sensa` —
  ver `04_Esqueleto_Tecnico_Inicial.md`, sección 9).
- Alta/baja de Empresa Revendedora.

**Quién puede consultarlo:**
- El Operador Principal ve el log completo de todas las Empresas Revendedoras, pero respetando la
  misma restricción de campos de la sección 4.2 (ID, no nombres) cuando el registro involucra un
  Cliente Final.
- Cada Empresa Revendedora ve únicamente el log de sus propias acciones.

**No incluido en el MVP:** alertas automáticas por email/notificación push sobre eventos del log —
por ahora es solo consulta manual dentro del panel.

## 12. Alerta de Cuenta cerca del tope de capacidad

**Incluido en el MVP.** El panel de la Empresa Revendedora muestra un aviso visual (no email, no
notificación push) cuando una Cuenta alcanza **2 de 3** ventas/Dispositivos comerciales globales,
sin contar reservas técnicas, para anticipar que una venta adicional puede requerir otra Cuenta
compatible (ver flujo 4.1 del esqueleto técnico). El umbral (2 de 3) es un valor inicial sugerido —
**a validar con Federico** si conviene
que sea configurable por el Operador Principal en una etapa posterior.

## 13. Exportación de datos propios a CSV

**Incluido en el MVP.** La Empresa Revendedora puede exportar a CSV el listado de sus Clientes
Finales (incluyendo `numero_cliente` e `id_gestion_externo`) y de sus Dispositivos, para facilitar
la conciliación manual con su propio sistema de gestión/CRM externo. No incluye automatización ni
integración directa (eso queda para la API pública de la sección 8 del esqueleto técnico, fase 2).

## 14. Datos registrados de la Empresa Revendedora

Al dar de alta una Empresa Revendedora, el Operador Principal carga los siguientes datos de uso
administrativo/legal. El nombre y apellido del contacto se envían a SENSA al crear Cuentas; el
teléfono y la dirección funcionan además como fallback cuando faltan en el Cliente Final:

- Razón social
- CUIT
- Dirección
- Nombre y apellido de un contacto principal
- Teléfono
- Correo electrónico (también es la base para los correos de contacto de cada Cuenta — sección 2.3)
- Sitio web (opcional)

**Incluido en el alcance del MVP.**
