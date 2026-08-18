# IPTVControl — Decisiones Pendientes (consolidado)

> Este documento junta, en un solo lugar, todas las decisiones que **todavía no están cerradas**
> en `01_Instrucciones_del_Proyecto.md`, `03_Reglas_de_Negocio.md` y `04_Esqueleto_Tecnico_Inicial.md`.
> Ningún agente (ni humano) debe asumir una resolución para estos puntos — están acá justamente
> para que no se pierdan de vista mientras se programa. Cuando Bruno o Federico cierren alguno,
> hay que actualizar este documento y el documento de origen correspondiente.

**Importante — no confundir con lo ya resuelto:** el riesgo de contraseña compartida sin rotación
(`03_Reglas_de_Negocio.md`, sección 6) **no es una decisión pendiente**: es un riesgo de negocio
**ya aceptado y confirmado por Bruno**. No debe listarse ni tratarse acá como algo a resolver.

## 1. Comercial / negocio

- **Modelo de licenciamiento del software IPTVControl hacia otros distribuidores futuros**: sin
  definir. Depende de una decisión comercial de Bruno, no técnica. No bloquea el desarrollo del
  MVP (Tecnología Activa es hoy el único Operador Principal), pero sí condiciona el diseño de
  facturación/licencias cuando se aborde el multi-Operador-Principal.

## 2. Autenticación y provisioning (Auth0)

- **Mecanismo exacto de provisioning del primer Team Member root** (`04_Esqueleto_Tecnico_Inicial.md`,
  sección 4.6): **script de seed manual** (`npm run seed:root`, ejecutado a mano una vez) vs.
  **seed automático** disparado por `docker-compose up` si detecta la tabla `TeamMember` vacía —
  **a definir con Federico**.
- **Invitación de Team Members no-root** (`04_Esqueleto_Tecnico_Inicial.md`, sección 4.7), vía
  Password Change Tickets de Auth0:
  - Quién manda el email de invitación (backend con servicio propio de mail vs. plantilla nativa
    de Auth0) — **se propuso backend propio, a confirmar con Federico**.
  - Tiempo de vencimiento del link (`ttl_sec`) — se usó 72hs como valor de ejemplo en el código de
    referencia, **no es una decisión cerrada**.
  - Mecanismo de reenvío de invitación si el link vence.
  - Evaluar a mediano plazo migrar a **Auth0 Organizations** (se descartó para el MVP porque ata
    la arquitectura a modelar cada Empresa Revendedora como una Organization de Auth0).

## 3. Seguridad de datos sensibles

- **Resguardo de contraseña y PIN de Cuenta mostrados en las vistas del panel**
  (`03_Reglas_de_Negocio.md`, sección 8; `04_Esqueleto_Tecnico_Inicial.md`, sección 6): cifrado en
  base de datos ya definido (AES-256-GCM), pero falta definir con Federico **control de quién
  puede verlos** y si conviene **registro de accesos/consultas** a esos campos específicos (más
  allá del Audit Log general de altas/bajas).

## 4. Integración SENSA — casos límite

- **Reintento infinito de DNI** (`04_Esqueleto_Tecnico_Inicial.md`, sección 6): si SENSA rechaza
  muchos DNIs consecutivos por "ID (DNI) repetido", ¿hay un límite de reintentos antes de alertar
  al soporte, o el sistema reintenta indefinidamente? Sin definir.

## 5. Parametrización — umbrales y validaciones

- **Umbral de la alerta de Cuenta cerca del tope** (`03_Reglas_de_Negocio.md`, sección 12): el
  valor **2 de 3** dispositivos habilitados es un valor inicial sugerido. Falta validar con
  Federico si conviene que sea **configurable por el Operador Principal** en una etapa posterior,
  en vez de quedar fijo en el código.
- **Formato exacto del CUIT de la Empresa Revendedora** (`04_Esqueleto_Tecnico_Inicial.md`,
  sección 6): se asumió **string de 11 dígitos sin guiones**, por consistencia con el campo `cuit`
  que usa SENSA para sus "hoteles". Falta confirmar con Federico si conviene aplicar esa misma
  validación a nivel backend.

## 6. Menú de Parametrización — conexión SENSA (`04_Esqueleto_Tecnico_Inicial.md`, sección 9)

- Nombres y contrato de request/response definitivos de los tres endpoints propuestos
  (`GET /api/v1/settings/sensa`, `PATCH /api/v1/settings/sensa`,
  `POST /api/v1/settings/sensa/test-connection`) — son un placeholder, **a validar con Federico**
  según la convención real del backend NestJS.
- Si `operator_admin` accede sin restricción a esta sección, o si conviene un sub-permiso
  específico (relacionado con la profesionalización general de roles de Tecnología Activa, no
  bloqueante para el MVP).
- Conectar el componente de referencia `sensa_settings_menu.jsx` (entregado por Claude el
  14/08/2026, guardado y test de conexión simulados) a los endpoints reales de arriba.
- Resto de secciones del Menú de Parametrización más allá de la conexión SENSA (límite de
  reintentos de DNI, notificaciones, datos generales del Operador Principal) — quedan fuera de
  esta primera versión, se documentan a medida que se definan.

## 7. Documentación / infraestructura de trabajo

- ~~**Vault de Obsidian nuevo** y estructura de carpetas del repo~~ → **hecho**: vault en `vault/`
  y estructura documentada en `AGENTS.md`. La carpeta `opencode-tasks/` no se creó: el seguimiento
  vive en este documento y en el knowledge graph de Graphify (`graphify-out/`).
- Una vez exista código, generar el mapeo técnico + UX con el flujo de 5 fases ya utilizado en
  otros proyectos de Tecnología Activa.

## 8. Fuente descartada — recordatorio

El **documento de tareas de Federico** está **descartado definitivamente** como fuente de
referencia (`03_Reglas_de_Negocio.md`, sección 10) por contradecir decisiones ya confirmadas
(módulo de facturación fuera de MVP, X5/X10 vs. FULL/RETAIL, baja individual de dispositivo,
ausencia del `ProveedorAdapter`). Ningún agente debe usarlo para planificar ni ejecutar tareas,
ni siquiera como referencia secundaria. Bruno maneja directamente con Federico cualquier
comunicación al respecto.
