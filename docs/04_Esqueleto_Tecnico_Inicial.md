# IPTVControl — Esqueleto Técnico Inicial

> Este documento es un punto de partida para conversar con Federico y el equipo de desarrollo.
> No es diseño final de base de datos ni de arquitectura — es la traducción de las reglas de
> negocio a un modelo de entidades preliminar, para validar entendimiento antes de programar.

## 1. Entidades principales (borrador de modelo de datos)

```
OperadorPrincipal
├── id
├── nombre
├── proveedor_activo (FK → Proveedor; hoy siempre "SENSA")
├── dni_inicial_sensa (número inicial parametrizable para generar el ID/DNI de alta en SENSA —
│                       ver sección 3.2)
└── configuracion_proveedor (credenciales/API keys del proveedor, aisladas por Operador —
                              editable desde el Menú de Parametrización, ver sección 9)
    ├── server (host de la API del Proveedor, ej. "api.sensa.com")
    ├── port (puerto de conexión, ej. "443")
    ├── user (usuario para Basic Auth)
    └── token (cifrado en base de datos — ver sección 2.1, "Encriptación")

Proveedor
├── id
├── nombre (ej. "SENSA")
└── tipo_conector (referencia al adaptador de integración — ver sección 4)

EmpresaRevendedora
├── id
├── operador_principal_id (FK)
├── razon_social
├── cuit
├── direccion
├── nombre_contacto
├── apellido_contacto
├── telefono_contacto
├── email_contacto (base para generar los correos de contacto de cada Cuenta — ver sección 3.2)
├── sitio_web (opcional)
├── modalidad_comercial (ENUM: "menudeo" | "obligacion_mensual")
├── escala_actual (ej. "X5", "X10", null si es menudeo)
├── login / credenciales_panel
└── estado (activa/suspendida)

ClienteFinal
├── id
├── empresa_revendedora_id (FK)
├── numero_cliente (correlativo interno de IPTVControl)
├── id_gestion_externo (opcional — ID del cliente en el sistema de gestión propio de la Empresa
│                         Revendedora, para vincular con su CRM/facturación externa; validado
│                         contra duplicados dentro de la misma Empresa Revendedora al momento del
│                         alta — ver 03_Reglas_de_Negocio.md, sección 2.4)
├── nombre / datos de contacto
├── tipo_alta (ENUM: "cuenta_exclusiva" | "dispositivo_compartido")
└── estado (activo/suspendido/dado de baja)

Cuenta
├── id
├── empresa_revendedora_id (FK)
├── proveedor_cuenta_id (ID que devuelve SENSA)
├── dni_alta_sensa (identificador tipo DNI generado internamente para el alta — ver sección 3.2)
├── usuario / password / pin (credenciales de la cuenta en SENSA)
├── email_contacto (correo derivado del de la Empresa Revendedora + número creciente — sección 3.2)
├── es_exclusiva (boolean — true si fue creada para un único Cliente Final vía "cuenta exclusiva")
├── dispositivos_fijos_habilitados (0-3, arranca en 1)
├── dispositivos_moviles_habilitados (0-3, arranca en 1)
└── estado (activa/cerrada)

Dispositivo
├── id
├── cuenta_id (FK)
├── cliente_final_id (FK, nullable — null cuando el Dispositivo está bloqueado por suspensión y
│                       no tiene cliente activo asociado)
├── proveedor_device_id (ID que devuelve SENSA al activar)
├── tipo (ENUM: "fijo" | "movil")
├── nota_descriptiva (texto libre de la Empresa Revendedora, ej. "TV living" — no se envía a SENSA)
└── estado (ENUM: "activo" | "bloqueado_por_suspension" | "disponible" | "dado_de_baja")

TeamMember (login con permisos — ver 02_Glosario, sección "Team Member")
├── id
├── operador_principal_id (FK, nullable — null si pertenece a una Empresa Revendedora)
├── empresa_revendedora_id (FK, nullable — null si pertenece al Operador Principal; exactamente
│                             uno de los dos FK está poblado, nunca ambos ni ninguno)
├── auth0_user_id (referencia al usuario en Auth0 — la autenticación en sí vive en Auth0, esta
│                    tabla solo mapea ese usuario a un tenant y un rol dentro de IPTVControl)
├── email
├── rol (ENUM: "operator_admin" | "operator_staff" | "reseller_admin" | "reseller_staff" — en el
│         MVP solo se usan "operator_admin" y "reseller_admin", ver 03_Reglas_de_Negocio sección 4)
└── estado (activo/inactivo)

AuditLog (registro de auditoría — ver 03_Reglas_de_Negocio, sección 11)
├── id
├── team_member_id (FK — quién ejecutó la acción)
├── accion (ENUM: "alta_cliente" | "suspension_cliente" | "baja_cliente" | "reasignacion_dispositivo"
│           | "cambio_modalidad_comercial" | "cambio_precio" | "alta_empresa_revendedora"
│           | "cambio_configuracion_proveedor" | ...)
├── entidad_afectada (ENUM: "ClienteFinal" | "Dispositivo" | "Cuenta" | "EmpresaRevendedora" | "ModalidadComercial")
├── entidad_id (id del registro afectado)
├── detalle (JSON — datos relevantes del cambio, ej. valores anterior/nuevo)
└── timestamp

ModalidadComercial (tabla de parametrización, gestionada por Operador Principal)
├── id
├── operador_principal_id (FK)
├── tipo (ENUM: "menudeo" | "obligacion_mensual")
├── escala (ej. "X5", "X10", o rangos de volumen para menudeo)
├── precio_por_cuenta
├── ritmo_incremento (para obligación mensual — cuánto crece el compromiso por mes)
└── vigente_desde / vigente_hasta (para soportar actualización por IPC)
```

## 2. Relaciones clave

### 2.1. Stack técnico confirmado

| Capa | Tecnología | Nota |
|---|---|---|
| Backend | NestJS | Módulos/DI/guards — consistencia para código generado por opencode |
| Base de datos | **PostgreSQL** (reemplaza MySQL) | Row-Level Security nativo para aislamiento multi-tenant |
| ORM | Prisma | Sin soporte nativo de RLS — combinar con `SET app.current_tenant` por request (middleware NestJS) + políticas RLS en Postgres como segunda capa |
| Colas | BullMQ + Redis | Reintentos ante fallas de la API de SENSA |
| Auth | Auth0 + JWT | Tenant nuevo desde cero bajo Tecnología Activa |
| Frontend | Vite + React + shadcn/ui + TanStack Query + React Router | Sin Next.js — no hace falta SSR |
| Infra | VPS propio + Docker/Docker Compose | ~4 vCPU / 8GB RAM alcanza para la escala esperada (~10 Empresas Revendedoras, ~9.000 Clientes Finales) |
| Documentación para el agente | `AGENTS.md` en la raíz del repo + Graphify (knowledge graph) | Memoria persistente de opencode entre sesiones |
| API docs | Swagger en `/api/docs`, visible solo con login | |

**Encriptación:** credenciales de Cuenta SENSA encriptadas en base de datos (AES-256-GCM a nivel
aplicación, clave maestra fuera del repo). **Rate limiting** habilitado contra la API de SENSA.
**Testing de integración:** directo contra el ambiente de **producción** de SENSA, con Cuentas ya
abonadas por Tecnología Activa (no hay modo "dry-run" separado). **Ambientes:** arranca directo en
producción controlada, sin staging separado. **Backups:** a cargo del departamento de
infraestructura, fuera del alcance de este desarrollo. **API de SENSA sin webhooks** — toda la
integración es por consulta activa (polling) desde IPTVControl.

### 2.2. Relaciones entre entidades

- Un **Operador Principal** tiene muchas **Empresas Revendedoras**.
- Una **Empresa Revendedora** tiene muchos **Clientes Finales** y muchas **Cuentas**.
- Una **Cuenta** tiene hasta 6 **Dispositivos** (máx. 3 fijos + 3 móviles).
- Un **Dispositivo** pertenece a una única **Cuenta**, y a un único **Cliente Final** mientras esté
  activo (puede quedar sin Cliente Final asociado si está bloqueado por suspensión).
- Un **Cliente Final** puede tener uno o más **Dispositivos**, incluso en **Cuentas distintas** si
  tuvo que migrar de Cuenta por falta de capacidad (ver sección 4.4).
- Un **Team Member** pertenece a un único tenant: **o bien** a un Operador Principal, **o bien** a
  una Empresa Revendedora — nunca a ambos. Un Operador Principal o una Empresa Revendedora pueden
  tener uno o más Team Members (en el MVP, una Empresa Revendedora tiene como máximo uno).
- Cada registro de **AuditLog** queda asociado a un **Team Member** (quién ejecutó la acción) y,
  según el tipo de acción, a la entidad afectada (Cliente Final, Dispositivo, Cuenta, Empresa
  Revendedora o Modalidad Comercial).

## 3. Integración con el Proveedor (SENSA) — patrón de conector desacoplado

Dado que el sistema debe soportar otros Proveedores en el futuro (regla de negocio confirmada por
Bruno), la integración con SENSA **no debe programarse hardcodeada** en la lógica de negocio.
Patrón sugerido para conversar con el equipo:

```
[Lógica de negocio de IPTVControl]
          │
          ▼
[Interfaz ProveedorAdapter] ← contrato común (crear cuenta, actualizar dispositivos, activar
          │                    dispositivo, consultar estado, etc.)
          ▼
[SensaAdapter implements ProveedorAdapter]  ← única implementación en el MVP
```

Esto permite que, si mañana se integra otro Proveedor, se cree un nuevo adapter sin tocar la
lógica de negocio central.

### 3.1. Identificadores requeridos por SENSA
SENSA exige, para dar de alta una Cuenta, un identificador tipo **DNI** y un **correo de
contacto**. Como IPTVControl no gestiona DNIs reales de personas físicas, ambos se generan:

- **DNI:** arranca en `dni_inicial_sensa` (parametrizable por Operador Principal) y se incrementa
  de a 1 en cada alta de Cuenta nueva. Si la API de SENSA devuelve error de "ID (DNI) repetido",
  el adapter debe **incrementar el DNI en 1 y reintentar automáticamente**, sin exponer ese error
  al usuario final (ver flujo 4.1).
- **Correo de contacto:** `email_contacto` de la Empresa Revendedora + un número creciente antes
  de la arroba (ej. `contacto1@isp.com`, `contacto2@isp.com`, ...).

## 4. Flujos principales (a diagramar en Mermaid en la documentación Obsidian)

### 4.1. Alta de Cliente Final — dos métodos
1. Empresa Revendedora crea Cliente Final en el panel, eligiendo **método de alta**:
   `cuenta_exclusiva` o `dispositivo_compartido`.
2. Si la Empresa Revendedora cargó `id_gestion_externo`, el sistema valida si ya existe un Cliente
   Final activo con ese mismo ID dentro de la misma Empresa Revendedora. Si hay coincidencia,
   muestra una advertencia con dos opciones: **agrupar** (deriva al flujo 4.4, alta de Dispositivo
   adicional para el Cliente Final ya existente) o **crear de todos modos** (continúa el flujo
   normal como Cliente Final nuevo e independiente) — ver `03_Reglas_de_Negocio.md`, sección 2.4.
3. **Si es `cuenta_exclusiva`:** el sistema salta directo al paso 5 (crear Cuenta nueva), sin
   buscar Cuentas existentes.
4. **Si es `dispositivo_compartido`:** el sistema busca una Cuenta propia de esa Empresa
   Revendedora con Dispositivo disponible del tipo requerido (fijo/móvil). Si existe → API a
   SENSA: actualizar parametrización +1 dispositivo, y continuar en el paso 6.
5. Si no hay Cuenta disponible (o el método es `cuenta_exclusiva`) → generar `dni_alta_sensa`
   (ver 3.1) → API a SENSA: crear Cuenta nueva (1 fijo + 1 móvil, con `email_contacto` generado).
   Si SENSA responde "DNI repetido" → incrementar DNI y reintentar este paso.
6. API a SENSA: activar el dispositivo correspondiente.
7. SENSA devuelve `proveedor_device_id` → se guarda y se vincula Dispositivo ↔ Cliente Final ↔
   Cuenta.
8. Si la API falla en cualquier paso (fuera del caso "DNI repetido", que se maneja internamente)
   → notificación al usuario ("sistema congestionado...") sin dejar estado inconsistente en la
   base local.

### 4.2. Baja definitiva de Cliente Final
1. Empresa Revendedora marca la baja definitiva del Cliente Final.
2. Sistema elimina el/los Dispositivo(s) asociados y actualiza vía API la parametrización de la
   Cuenta en SENSA, restando 1 dispositivo habilitado por cada uno (lógica inversa exacta al alta).
3. El/los Dispositivo(s) pasan a estado `disponible` — **quedan liberados y disponibles** para
   asignarse a un Cliente Final nuevo, siguiendo el flujo 4.1 normal (búsqueda de Cuenta con
   Dispositivo disponible, o creación de Cuenta nueva si corresponde).

### 4.3. Suspensión de Cliente Final
1. Empresa Revendedora marca la suspensión del Cliente Final.
2. Sistema elimina el/los Dispositivo(s) asociados y resta 1 dispositivo habilitado en la Cuenta
   vía API a SENSA (mismo mecanismo que la baja).
3. El/los Dispositivo(s) pasan a estado `bloqueado_por_suspension` — **no** se ofrecen en el flujo
   4.1 de búsqueda de Cuenta disponible mientras estén en este estado.
4. **Única salida de este estado:** que la Empresa Revendedora ejecute la transición explícita de
   "suspendido" a "baja definitiva" sobre ese Cliente Final (dispara el flujo 4.2, y recién ahí el
   Dispositivo pasa a `disponible`).

### 4.4. Alta de Dispositivo adicional / migración de Cuenta
1. Empresa Revendedora pide agregar un Dispositivo adicional a un Cliente Final que ya tiene
   Dispositivo(s) — ya sea de forma manual, o derivado automáticamente del paso 2 del flujo 4.1
   (coincidencia de `id_gestion_externo`, opción "agrupar").
2. Sistema verifica si la Cuenta actual del Cliente Final tiene lugar disponible del tipo pedido.
3. Si hay lugar → sigue el flujo normal de alta de Dispositivo (paso 4 del flujo 4.1).
4. Si **no** hay lugar (Cuenta en tope 3+3) → el sistema debe crear/asignar una **Cuenta nueva**
   con capacidad suficiente para la cantidad total de Dispositivos del Cliente Final, y **migrar**
   ahí los Dispositivos existentes de ese cliente (actualizando `cuenta_id` en cada Dispositivo, y
   la parametrización correspondiente en SENSA para ambas Cuentas).

### 4.5. Cambio de modalidad comercial o escala
1. Solo ejecutable por el Operador Principal (no autogestionable por la Empresa Revendedora),
   tanto para downgrade como para upgrade de escala.
2. Sistema actualiza `ModalidadComercial` vigente de la Empresa Revendedora.

### 4.6. Provisioning del primer Team Member root (bootstrap)

**Problema a resolver:** el sistema exige un Team Member con permisos (`operator_admin`) para dar
de alta cualquier otra cosa, pero el primer `operator_admin` no puede darse de alta desde el panel
porque, en ese momento, no existe todavía nadie con permisos para crearlo.

**Mecanismo propuesto (a validar con Federico):**
1. Se crea manualmente un usuario en el tenant de **Auth0** de Tecnología Activa (vía dashboard de
   Auth0, o vía su Management API dentro de un script de seed) con el email de Bruno.
2. Un **script de seed** (`npm run seed:root`, ejecutado una única vez al desplegar) inserta en la
   base de datos:
   - El primer registro de `OperadorPrincipal` (Tecnología Activa).
   - El primer registro de `Proveedor` (SENSA).
   - Un `TeamMember` con `rol = operator_admin`, vinculado al `auth0_user_id` creado en el paso 1
     y al `OperadorPrincipal` recién insertado.
3. Con eso, apenas termine el desarrollo, Bruno inicia sesión con ese usuario y ya tiene permisos
   totales para configurar el resto (modalidades comerciales, `dni_inicial_sensa`, credenciales de
   SENSA, etc.) sin depender de que nadie más lo habilite primero.

**Alternativa más simple** (si no querés depender de un script separado): exponer el mismo seed
como parte del comando de arranque inicial del contenedor Docker (`docker-compose up` corre el seed
si detecta que la tabla `TeamMember` está vacía), para no tener que acordarse de correr un comando
aparte la primera vez. **Queda para definir con Federico** cuál de las dos variantes conviene más
para el flujo de deploy que van a usar.

### 4.7. Invitación de Team Members no-root (alta de `reseller_admin` y futuros `operator_staff`)

**Contexto:** a diferencia del primer Team Member root (sección 4.6, resuelto por seed), todo el
resto de los Team Members —en el MVP, puntualmente el `reseller_admin` de cada Empresa
Revendedora— se da de alta desde el panel (`/team-members`, ver
`IPTVControl_URL_Routing_Convention.md`, sección 4.3). Faltaba definir el mecanismo exacto por el
que esa persona termina con una contraseña propia en Auth0 sin que IPTVControl ni Auth0 lleguen a
conocerla en ningún momento.

**Mecanismo propuesto (a validar con Federico):** usar los **Password Change Tickets** de la
Management API de Auth0 — un link de un solo uso, con vencimiento, que le permite al invitado
elegir su propia contraseña.

**Flujo:**
1. Un `operator_admin` da de alta la Empresa Revendedora desde el panel, cargando el email de
   contacto que va a ser el login del `reseller_admin`.
2. El backend (NestJS) llama a la Management API de Auth0 para:
   - Crear el usuario en Auth0 (`POST /api/v2/users`), con `email_verified: false` y una
     contraseña aleatoria descartable (Auth0 la exige al crear el usuario, pero nunca se usa ni
     se muestra).
   - Generar un ticket de cambio de contraseña (`POST /api/v2/tickets/password-change`) pasando
     el `user_id` recién creado. Auth0 devuelve una URL única de un solo uso.
3. El backend guarda el `TeamMember` en la base (`auth0_user_id`, `rol = reseller_admin`,
   `empresa_revendedora_id`), y **envía la URL del ticket por email propio** (no es un mail que
   mande Auth0 — se arma con el servicio de mail que defina el equipo).
4. El invitado hace clic, Auth0 le muestra una pantalla propia (personalizable con la marca de
   IPTVControl) para elegir contraseña, y queda habilitado para loguearse normalmente.

**Ejemplo de implementación (esqueleto, no versión final de producción):**

```typescript
// team-members.service.ts
// Servicio encargado de generar la invitación inicial de un Team Member
// (reseller_admin u operator_staff a futuro). Usa la Management API de Auth0.

import { Injectable } from '@nestjs/common';
import { ManagementClient } from 'auth0'; // SDK oficial de Auth0 para Node

@Injectable()
export class TeamMembersService {
  private auth0Mgmt: ManagementClient;

  constructor() {
    // IMPORTANTE: estas credenciales son de una "Machine to Machine Application"
    // que hay que crear en el dashboard de Auth0, autorizada específicamente
    // para hablar con la Management API (no confundir con el client de login normal).
    this.auth0Mgmt = new ManagementClient({
      domain: process.env.AUTH0_DOMAIN,          // ej: tecnologiaactiva.us.auth0.com
      clientId: process.env.AUTH0_MGMT_CLIENT_ID,
      clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET,
    });
  }

  async crearInvitacionResellerAdmin(email: string, empresaRevendedoraId: string) {
    // 1. Crear el usuario en Auth0 (todavía sin contraseña "real" definida por él)
    const auth0User = await this.auth0Mgmt.users.create({
      connection: 'Username-Password-Authentication', // conexión de base de datos de Auth0
      email,
      password: crypto.randomUUID(), // descartable, nunca se comunica
      email_verified: false,
      app_metadata: {
        // Metadata que después el JWT puede exponer como claims custom,
        // útil para el middleware de multi-tenant (SET app.current_tenant)
        rol: 'reseller_admin',
        empresa_revendedora_id: empresaRevendedoraId,
      },
    });

    // 2. Generar el ticket de invitación (link de un solo uso)
    const ticket = await this.auth0Mgmt.tickets.changePassword({
      user_id: auth0User.data.user_id,
      result_url: 'https://panel.iptvcontrol.com.ar/bienvenida', // a donde redirige tras elegir password
      ttl_sec: 259200, // 72hs de validez — a definir con Federico el tiempo exacto
    });

    // 3. Guardar el TeamMember en la base (Postgres/Prisma)
    // rol: 'reseller_admin', estado: 'invitado' (o el enum que se defina)
    // auth0_user_id: auth0User.data.user_id

    // 4. Devolver la URL para que otra parte del sistema arme y mande el email
    return ticket.data.ticket;
  }
}
```

**Pendientes de definición (a validar con Federico):**
- **Quién manda el email de invitación:** lo más prolijo para mantener la marca de IPTVControl es
  que el backend lo mande con su propio servicio de mail (ej. SendGrid, Resend, o SMTP propio)
  usando la URL del ticket, en vez de depender de la plantilla nativa de Auth0.
- **Vencimiento del link (`ttl_sec`):** 72hs es un valor de ejemplo, no una decisión cerrada.
- **Reenvío de invitación:** si el link vence o el mail se pierde, conviene que el panel tenga un
  botón "Reenviar invitación" que genere un ticket nuevo para el mismo `auth0_user_id`, sin
  necesidad de recrear el usuario.
- **Alternativa evaluada y descartada para el MVP:** Auth0 tiene un producto llamado
  "**Organizations**", con invitaciones nativas pensadas justo para modelos B2B multi-tenant como
  este (Auth0 arma y manda el mail de invitación solo). Se descarta para el MVP porque implicaría
  modelar cada Empresa Revendedora como una "Organization" de Auth0 en lugar de un FK simple en
  `TeamMember`, lo cual ata la arquitectura a ese concepto. **Vale la pena replantearlo con
  Federico a mediano plazo** si el número de Empresas Revendedoras crece mucho.

## 5. Vistas y requisitos de UX (a detallar con Federico)

- **Panel del Operador Principal:** desktop-first. Incluye un **dashboard** simple con Cuentas
  vendidas, disponibles y bloqueadas, más un **panel de salud de la integración con SENSA**
  (últimas llamadas exitosas/fallidas, tamaño de la cola de reintentos pendientes en BullMQ) —
  da visibilidad temprana de problemas de integración antes de que una Empresa Revendedora reporte
  el síntoma.
- **Panel de la Empresa Revendedora:** panel completamente separado del anterior, **100%
  responsive** — los Revendedores operan mayormente desde el celular.
- **Alta de Cliente Final:** implementada como **wizard** (asistente paso a paso), no como un
  formulario único, dados los dos métodos de alta (sección 2.1 de `03_Reglas_de_Negocio.md`) y la
  validación de `id_gestion_externo` (sección 2.4 de `03_Reglas_de_Negocio.md`).
- **Vista por Cuenta:** usuario, contraseña, PIN, parametrización de contenido, y listado de
  Clientes Finales + Dispositivos relacionados con esa Cuenta.
- **Vista por Cliente:** usuario, contraseña y PIN de la Cuenta del cliente, parametrización de
  contenido, Dispositivos de ese cliente, y botón para saltar a la vista completa de la Cuenta.
- **Vista del Operador Principal sobre Cuentas/Dispositivos de una Empresa Revendedora:** misma
  tabla que la vista por Cuenta, pero **sin usuario/password/PIN, sin nombre ni datos de contacto
  del Cliente Final, y sin `nota_descriptiva`** — ver tabla normativa de campos permitidos en
  `03_Reglas_de_Negocio.md`, sección 4.2.
- **Alerta de Cuenta cerca del tope:** aviso visual en el panel de la Empresa Revendedora cuando
  una Cuenta llega a 2 de 3 dispositivos habilitados en alguna categoría (ver
  `03_Reglas_de_Negocio.md`, sección 12).
- **Exportación a CSV:** botón en el listado de Clientes Finales y de Dispositivos del panel de la
  Empresa Revendedora (ver `03_Reglas_de_Negocio.md`, sección 13).
- Ambas vistas deben soportar **modo claro y modo oscuro**.
- **Reportes de consumo:** alcanza con reportes tabulares/exportables — no se requiere un
  dashboard analítico avanzado para esta primera etapa.
- **Idioma:** español únicamente. **Identidad visual:** sin definir (no hay logo todavía).

## 6. Preguntas técnicas — estado actualizado

**Ya resueltas** (quedan documentadas acá para no volver a preguntarlas):
- ~~Mecanismo de consistencia entre base local y SENSA ante fallos de API~~ → BullMQ + Redis para
  reintentos, con estado "pendiente" en la cola.
- ~~Estrategia de autenticación multi-tenant para los paneles de Empresa Revendedora~~ → Auth0 +
  JWT, más `SET app.current_tenant` por request (middleware NestJS) + Row-Level Security en
  Postgres como segunda capa de defensa.
- ~~Rate limits y manejo de concurrencia contra la API de SENSA~~ → documentación oficial ya
  adjunta al Proyecto (`API_Sensa_V4_1_3.pdf`); rate limiting habilitado del lado de IPTVControl.

**Siguen abiertas** (para tratar con Federico cuando arranque el desarrollo):
- **Mecanismo exacto de provisioning del primer Team Member root** (sección 4.6): script de seed
  manual vs. seed automático al primer arranque del contenedor — **a definir con Federico**.
- **Invitación de Team Members no-root** (sección 4.7): confirmar el uso de Password Change
  Tickets de Auth0, quién manda el email de invitación, el tiempo de vencimiento del link, y
  evaluar a mediano plazo si conviene migrar a Auth0 Organizations — **a definir con Federico**.
- **Resguardo de contraseña y PIN mostrados en las vistas del panel** (sección 5): cifrado en
  base de datos, control de acceso, registro de consultas.
- Manejo del caso límite de reintento infinito de DNI (¿qué pasa si SENSA rechaza muchos DNIs
  consecutivos? ¿límite de reintentos antes de alertar al soporte?).
- **Umbral de la alerta de Cuenta cerca del tope** (sección 3 de este documento / sección 12 de
  `03_Reglas_de_Negocio.md`): ¿fijo en 2 de 3, o configurable por el Operador Principal desde una
  etapa posterior?
- Modelo de licenciamiento del software hacia otros distribuidores (**pendiente de definición
  comercial por parte de Bruno**, sigue sin resolver).
- **Formato exacto del CUIT de la Empresa Revendedora** (sección 1 de este documento): se asumió
  string de 11 dígitos sin guiones, por consistencia con el campo `cuit` que usa SENSA para sus
  "hoteles" — **a confirmar con Federico** si conviene aplicar la misma validación a nivel backend.

## 7. Pendientes para completar esta documentación

- [x] Adjuntar documentación técnica oficial de la API de SENSA — **ya adjunta como
      `API_Sensa_V4_1_3.pdf`**, pendiente de revisión detallada por Federico.
- [x] Definir stack técnico y equipo de desarrollo — **cerrado**, ver sección 2.1.
- [x] Armar el vault de Obsidian nuevo (desde cero, no se reutiliza el de FTTHControl) y la
      estructura de carpetas del repo (`AGENTS.md`, backend NestJS, frontend Vite/React,
      `docker-compose.yml`) — **hecho**: vault en `vault/` (abrir esa carpeta como vault de
      Obsidian) y estructura del repo documentada en `AGENTS.md` → "Estructura del repositorio
      (implementada)". La carpeta `opencode-tasks/` no se creó: el seguimiento de tareas quedó en
      `docs/05_Decisiones_Pendientes.md` y en el knowledge graph de Graphify (`graphify-out/`).
- [ ] Una vez exista código, generar mapeo técnico + UX con el flujo de 5 fases ya utilizado en
      otros proyectos.

## 8. API pública para Empresas Revendedoras (decisión de arquitectura a favor — fase 2)

**No se implementa en el MVP.** Se documenta acá para que el diseño del backend no la bloquee más
adelante — el objetivo es que, si en el futuro una Empresa Revendedora grande quiere integrarse
directo (en vez de operar desde el panel), el camino ya esté allanado:

- Reutiliza el mismo patrón desacoplado del `ProveedorAdapter` (sección 3), pero expuesto hacia
  afuera: la lógica de negocio no cambia, solo se agrega una capa de autenticación por API key
  (una por Empresa Revendedora, revocable, con rate limiting propio — reutilizando el mecanismo ya
  definido para SENSA) delante de los mismos casos de uso que hoy expone el panel.
- Swagger ya está contemplado en el stack (`/api/docs`), así que la documentación de estos
  endpoints no implica herramienta nueva, solo exponer los que correspondan según scope de la
  API key.
- **Por qué importa dejarlo anotado ahora:** si el backend se diseña acoplando la lógica de negocio
  directamente a los controllers HTTP del panel, migrar a este esquema más adelante implica
  refactor. Si en cambio los casos de uso quedan en servicios de NestJS independientes de la capa
  HTTP (buena práctica de todos modos), exponer una API pública después es solo agregar
  controllers nuevos sobre los mismos servicios — **este es el criterio a bajarle a Federico desde
  el arranque del desarrollo**, aunque la API en sí no se construya en el MVP.

## 9. Menú de Parametrización — Conexión con SENSA

Sección del panel de Operador Principal (ruta `/settings`, ver
`IPTVControl_URL_Routing_Convention.md`) que permite administrar valores de configuración **sin
depender de un despliegue de código**. Nace del pedido explícito de Bruno de tener control directo
sobre los datos de conexión a SENSA. Corresponde al campo `configuracion_proveedor` de
`OperadorPrincipal` (sección 1).

### 9.1. Campos del formulario
- `server` / `port` — arman la URL base de la API: `https://<server>:<port>/v4/`.
- `user` / `token` — credenciales de Basic Auth (`<user>:<token>`) exigidas por la API de SENSA.
  El `token` se muestra oculto por defecto en el panel (tipo password, con opción de alternar a
  texto visible).
- `dni_inicial_sensa` — ya existía como campo parametrizable (sección 1); este menú es su interfaz
  de edición.

### 9.2. Botón "Probar conexión"
Antes de guardar, dispara el método `Test API` de SENSA (`GET /v4/`, sin autorización requerida
según `API_Sensa_V4_1_3.pdf`) para confirmar que el servidor responde. **Restricción de seguridad
no negociable:** el test debe ejecutarse *server-side*, vía un endpoint propio del backend que
internamente llame a SENSA — nunca desde el navegador directo, para no exponer el token en el
cliente.

### 9.3. Endpoints de backend (placeholder, no implementado)
- `GET /api/v1/settings/sensa` — obtener configuración actual (el `token` nunca se devuelve en claro).
- `PATCH /api/v1/settings/sensa` — actualizar configuración.
- `POST /api/v1/settings/sensa/test-connection` — ejecutar el test server-side contra `GET /v4/`.

Nombres de ruta a validar con Federico según la convención del backend NestJS.

### 9.4. Prototipo de referencia
Existe un componente React de referencia (`sensa_settings_menu.jsx`, entregado por Claude el
14/08/2026) como punto de partida visual y funcional. **No es código de producción** — el guardado
y el test de conexión están simulados; falta conectar los endpoints reales de 9.3 y el guard de
permisos de `operator_admin`.

### 9.5. Pendiente
- [ ] Definir con Federico los tres endpoints de 9.3 (nombres, contrato de request/response).
- [ ] Confirmar si `operator_admin` accede sin restricción a esta sección del menú, o si conviene
      un sub-permiso específico (relacionado con la etapa general de profesionalización de roles
      de Tecnología Activa — no bloqueante para el MVP).
- [ ] Conectar el componente de referencia (9.4) a los endpoints reales.
- [ ] Otras secciones del Menú de Parametrización, además de la conexión SENSA (umbral de alerta
      de Cuenta cerca del tope — ver pendiente en sección 6 de este documento —, límite de
      reintentos de DNI, notificaciones, datos generales del Operador Principal) quedan fuera de
      esta primera versión y se documentarán acá mismo a medida que se definan.
