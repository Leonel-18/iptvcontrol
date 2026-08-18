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
1. **Cuenta completa exclusiva** (sin compartir con otros Clientes Finales): el sistema siempre
   crea una Cuenta nueva en SENSA para ese cliente, sin buscar espacio en Cuentas existentes.
2. **Solo alta de un Dispositivo** (fijo o móvil): la Cuenta se comparte con otros Clientes
   Finales. En este caso:
   - El sistema busca si la Empresa Revendedora ya tiene una Cuenta propia con un Dispositivo
     disponible del tipo pedido.
   - Si existe: se asocia el nuevo Dispositivo a esa Cuenta, y se actualiza la parametrización de
     la Cuenta en SENSA vía API (+1 dispositivo, respetando el tope 3 fijos / 3 móviles).
   - Si no existe: el sistema crea una Cuenta nueva en SENSA vía API, parametrizada en **1 fijo +
     1 móvil** (arranque mínimo, no 0+0 ni 3+3 de entrada), y asocia el Dispositivo a esa Cuenta.
3. Cada alta/baja de Dispositivo modifica la parametrización de la Cuenta de a un dispositivo por
   vez (nunca en bloque).

### 2.2. Alta de Dispositivo adicional para un Cliente Final ya existente
La Empresa Revendedora puede sumarle a un Cliente Final que ya tiene Dispositivo(s) uno adicional:
- Si la Cuenta actual del Cliente Final tiene lugar disponible del tipo pedido, el nuevo
  Dispositivo se agrega ahí, con el mismo mecanismo de alta descripto arriba.
- Si la Cuenta actual **ya llegó a su tope** (3 fijos + 3 móviles) y no puede sumar más, el sistema
  debe **asignarle al Cliente Final una Cuenta nueva** con capacidad suficiente para la cantidad
  total de Dispositivos deseada — es decir, se le **cambia de Cuenta** al Cliente Final, migrando
  ahí sus Dispositivos existentes.
- La baja de uno de varios Dispositivos de un mismo Cliente Final (sin dar de baja al cliente
  entero) no afecta a los demás Dispositivos de ese cliente ni a su estado general.

### 2.3. Identificador (DNI) y correo de contacto exigidos por SENSA
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

### 2.4. Validación de duplicados por ID de sistema de gestión externo

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

- **Alta:** la Empresa Revendedora da de alta al Cliente Final y su Dispositivo (fijo o móvil,
  categorías con tope independiente de 3 cada una dentro de la misma Cuenta), por alguno de los
  dos métodos descriptos en la sección 2.1.
- **Identificación del Dispositivo:** se captura el ID que devuelve SENSA al momento de la
  activación vía API (no es un dato libre cargado por la Empresa Revendedora).
- **Baja definitiva:** la Empresa Revendedora marca manualmente la baja del Cliente Final. La
  lógica es **exactamente inversa al alta**: el sistema elimina el Dispositivo asociado y
  actualiza vía API la parametrización de la Cuenta en SENSA, restando 1 dispositivo habilitado.
  El Dispositivo **queda liberado y disponible** para que la Empresa Revendedora lo asigne a un
  Cliente Final nuevo, con el mismo flujo de alta normal (búsqueda de Cuenta con Dispositivo
  disponible, o creación de Cuenta nueva si corresponde). *(Incluido en el alcance del MVP.)*
- **Suspensión:** la Empresa Revendedora marca manualmente la suspensión del Cliente Final. El
  sistema también elimina el Dispositivo asociado y resta 1 dispositivo habilitado en la Cuenta
  vía API a SENSA, igual que en la baja — pero, a diferencia de la baja, ese Dispositivo **no debe
  quedar disponible para que otro Cliente Final lo ocupe**: el sistema debe "reservarlo"/
  bloquearlo, de forma que las credenciales de la Cuenta no terminen en manos de otro Cliente
  Final mientras exista la posibilidad de que el suspendido vuelva a activarse.
  *(Incluido en el alcance del MVP.)*
- **Transición de "suspendido" a "baja definitiva":** es la **única vía** para que un Dispositivo
  bloqueado por suspensión pase a estar disponible y pueda asignarse a un Cliente Final nuevo. La
  Empresa Revendedora ejecuta esta transición de forma explícita; recién en ese momento se libera
  la posibilidad de que otro Cliente Final obtenga esas credenciales (ver riesgo aceptado en la
  sección 6). Mientras el Cliente Final siga suspendido y no se ejecute esta transición, nadie más
  puede tomar su Dispositivo. *(Incluido en el alcance del MVP.)*
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
| Dispositivos habilitados (conteo, ej. "2 de 3 fijos") | Sí |
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

**Contraseña compartida entre Clientes Finales de una misma Cuenta:** dado que hasta 6 Clientes
Finales pueden compartir el mismo usuario/contraseña de una Cuenta SENSA, y dado que la baja
definitiva de un Cliente Final libera su Dispositivo para reasignarlo a un Cliente Final nuevo
**dentro del MVP**, ese cliente nuevo recibe las mismas credenciales de Cuenta que tenía el cliente
saliente, **sin que el sistema rote la contraseña**. Rotar la contraseña en cada reasignación
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
- Alta y baja de Dispositivo.
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
notificación push) cuando una Cuenta alcanza **2 de 3** dispositivos habilitados en alguna de las
dos categorías (fijo o móvil), para anticipar que el próximo alta de esa categoría va a requerir
buscar otra Cuenta con lugar disponible o crear una Cuenta nueva (ver flujo 4.1 del esqueleto
técnico). El umbral (2 de 3) es un valor inicial sugerido — **a validar con Federico** si conviene
que sea configurable por el Operador Principal en una etapa posterior.

## 13. Exportación de datos propios a CSV

**Incluido en el MVP.** La Empresa Revendedora puede exportar a CSV el listado de sus Clientes
Finales (incluyendo `numero_cliente` e `id_gestion_externo`) y de sus Dispositivos, para facilitar
la conciliación manual con su propio sistema de gestión/CRM externo. No incluye automatización ni
integración directa (eso queda para la API pública de la sección 8 del esqueleto técnico, fase 2).

## 14. Datos registrados de la Empresa Revendedora

Al dar de alta una Empresa Revendedora, el Operador Principal carga los siguientes datos, de uso
administrativo/legal (no se envían al Proveedor):

- Razón social
- CUIT
- Dirección
- Nombre y apellido de un contacto principal
- Teléfono
- Correo electrónico (también es la base para los correos de contacto de cada Cuenta — sección 2.3)
- Sitio web (opcional)

**Incluido en el alcance del MVP.**
