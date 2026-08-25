# IPTVControl — Instrucciones del Proyecto

## Qué es este proyecto

IPTVControl es un software desarrollado por **TECNOLOGIA ACTIVA S.A.S.** para automatizar la gestión
de reventa multinivel de cuentas IPTV (inicialmente sobre la plataforma de **SENSA**), diseñado desde
el inicio para ser **escalable a otros distribuidores** como producto propio, y para soportar en el
futuro **otros proveedores de contenido** además de SENSA.

El objetivo del sistema es que la operación de venta y gestión de cuentas/dispositivos "camine sola",
sin intervención manual del Operador Principal en el día a día.

Este Proyecto es el equivalente, para IPTVControl, de lo que ya venimos trabajando para FTTHControl:
documentación técnica + funcional persistente, para que Claude tenga siempre contexto completo del
sistema sin que Bruno tenga que repetir información en cada conversación.

## Cómo quiero que Claude me responda en este Proyecto

- Tono formal y corporativo, pero cercano y amistoso — nunca frío ni distante.
- Explicaciones con el razonamiento incluido, no solo la conclusión.
- Todo dato, cifra, nombre o decisión que yo tenga que revisar, confirmar o completar va en **negrita**.
- Soy principiante en programación. Mis devs (liderados por Federico) son de nivel intermedio.
  Cualquier código que se genere acá es código base/inicial para conversar con ellos — documentado
  con comentarios claros, no la versión final de producción.
- Para conceptos nuevos: explicación técnica correcta + ejemplo o analogía, preferentemente en
  contexto de telecom/ISP, que es el rubro que mejor conozco.
- Ante ambigüedad en requerimientos, preferí preguntar antes de asumir — este sistema maneja dinero
  y datos de terceros (empresas revendedoras), así que los errores de interpretación salen caros.

## Stack tecnológico

**Actualizado tras la definición técnica completa para desarrollo con opencode** (reemplaza el
stack genérico usado en otros proyectos de Tecnología Activa — este proyecto tiene stack propio):

- **Backend:** NestJS (sobre Node.js) — estructura fuerte (módulos, DI, guards) para que el código
  que genera un agente de IA sea consistente entre sesiones; trae soporte nativo de Swagger/OpenAPI.
- **Base de datos:** **PostgreSQL** (reemplaza la decisión previa de MySQL) — soporta Row-Level
  Security nativo, clave para el aislamiento multi-tenant entre Empresas Revendedoras.
- **ORM:** Prisma.
- **Colas y reintentos:** BullMQ + Redis — para manejar reintentos ante fallas de la API de SENSA.
- **Autenticación:** JWT + Auth0 (tenant nuevo, armado desde cero bajo Tecnología Activa).
- **Frontend:** Vite + React + shadcn/ui + TanStack Query + React Router. Sin Next.js — no hace
  falta SSR/SEO en un panel administrativo interno.
- **Infraestructura:** VPS propio + Docker / Docker Compose. Dimensionamiento estimado (~10
  Empresas Revendedoras, ~9.000 Clientes Finales, ~1.500 Cuentas): 4 vCPU / 8GB RAM alcanza de
  sobra — sin Kubernetes ni microservicios, sería sobre-ingeniería para este volumen.
- **Dominio:** `iptvcontrol.com.ar`.
- **Control de versiones:** GitHub, bajo la cuenta de Tecnología Activa. Repo y paquetes con
  nombre **`iptvcontrol`** a secas (sin prefijo de marca).
- **Branching:** trunk-based simplificado — `main` protegida + ramas cortas `feature/xxx`.
- **Encriptación de credenciales SENSA:** AES-256-GCM a nivel aplicación, clave maestra en
  variable de entorno/secreto del VPS (no en el repo). Las credenciales de Cuenta se encriptan
  en la base de datos.
- **Rate limiting:** sí, contra la API de SENSA.
- **Documentación técnica** (mapeo de API, Swagger, etc.): vive en el **repo de código**. La
  documentación funcional/de negocio (estos documentos + Obsidian) sigue el esquema ya usado en
  FTTHControl, pero con un **vault nuevo armado desde cero** para IPTVControl (no se reutiliza la
  estructura de FTTHControl).
- **Swagger:** expuesto en `/api/docs`, visible solo con login.
- **Memoria persistente del agente:** **opencode** (ya instalado) como CLI de desarrollo, con
  **Graphify** (knowledge graph del repo) para que tenga memoria de las decisiones entre sesiones.
  Archivo **`AGENTS.md`** en la raíz del repo con las reglas del proyecto, glosario resumido y
  convenciones — es el equivalente, para opencode, de las instrucciones de este Proyecto de Claude.
- Documentación técnica destinada a Obsidian, con diagramas Mermaid y wikilinks (vault nuevo,
  estructura propia de IPTVControl, no la de FTTHControl).

## Infraestructura y equipo de desarrollo

- **Servidor:** VPS propio (no hosting compartido ni servicios administrados de terceros).
- **Ambientes:** arranca directo en producción controlada, sin ambiente de staging separado por
  ahora.
- **Backups:** gestionados por el departamento de infraestructura de Tecnología Activa, por fuera
  del desarrollo del software.
- **Equipo:** un solo desarrollador operando con opencode (con conocimientos básicos del negocio)
  + un tester dedicado a control de calidad antes de pasar a producción.
- **Pruebas de integración con SENSA:** se hacen **directo contra el ambiente de producción de
  SENSA**, usando Cuentas que Tecnología Activa ya tiene abonadas (decisión explícita de Bruno:
  no se implementa un modo "dry-run" separado).
- **Documento de tareas de Federico:** **descartado definitivamente** como fuente de referencia
  para el desarrollo — no debe usarse ni citarse al planificar tareas. Bruno maneja directamente
  con Federico cualquier comunicación al respecto; no requiere intervención de Claude.
- **Idioma de la interfaz:** español únicamente por ahora (sin soporte multi-idioma en el MVP).
- **Identidad visual:** sin definir todavía — no hay logo ni lineamientos de marca al día de hoy.
- **Prioridad general de desarrollo:** velocidad de entrega por sobre testing automatizado
  exhaustivo o cronograma formal por sprints (se organiza por épicas/módulos, sin fechas fijas).
- **Diferenciador de I+D+i de Tecnología Activa:** es **puramente un argumento comercial** para
  propuestas — no aplica técnicamente al diseño de IPTVControl.

## Alcance del MVP (primera etapa)

**Incluido:**
- Alta de Operadores Principales, Empresas Revendedoras y Clientes Finales.
- Alta de Cliente Final por **dos métodos**: Cuenta completa exclusiva, con hasta 3 Dispositivos
  para un único Cliente Final, o venta unitaria de exactamente 1 Dispositivo dentro de una Cuenta
  compartida con ventas de idéntica firma de servicios (ver `03_Reglas_de_Negocio.md`).
- Creación y parametrización de Cuentas SENSA vía API con un máximo comercial global de
  **3 Dispositivos por Cuenta**, indistintamente del tipo informado después por SENSA.
- Protección de la capacidad no vendida de las Cuentas compartidas mediante Dispositivos de
  reserva técnicos, con MAC unicast administrada localmente y sin Cliente Final asociado.
  **[Superado — ver nota abajo]**
- Generación automática del identificador tipo DNI exigido por SENSA para cada Cuenta nueva (número
  inicial parametrizable por el Operador Principal, incremento ante colisión) y del correo de
  contacto asociado (ver `03_Reglas_de_Negocio.md`, sección 2).
- Alta de Dispositivos sin solicitar tipo ni MAC en el formulario: SENSA informa ID, MAC y tipo al
  primer login y el sistema los detecta durante una ventana inicial de 10 minutos, con sondeo cada
  30 segundos. En una venta unitaria, un candidato se vincula y varios dejan el alta ambigua; una
  Cuenta completa puede vincular hasta 3 candidatos al mismo Cliente Final.
- Alta de un Dispositivo adicional para un Cliente Final ya existente: si su Cuenta alcanzó el
  máximo global de 3, la venta adicional usa otra Cuenta compatible; nunca se intentan migrar
  cuatro Dispositivos a una sola Cuenta.
- **Baja definitiva de Cliente Final**, con liberación de capacidad comercial para una venta
  posterior dentro de esta misma etapa.
- **Suspensión de Cliente Final**, con bloqueo del Dispositivo liberado (no reasignable mientras
  dure la suspensión). La única vía para liberar esa capacidad comercial a otra venta es la
  transición explícita de "suspendido" a "baja definitiva" (ver
  `03_Reglas_de_Negocio.md`, sección 3).
- Vista por Cuenta y vista por Cliente en el panel de la Empresa Revendedora (usuario, contraseña,
  PIN, parametrización de contenido y relacionados — ver `03_Reglas_de_Negocio.md`, sección 8).
- Modo claro y modo oscuro en toda la interfaz.
- **Panel del Operador Principal:** desktop-first, con un **dashboard** simple mostrando Cuentas
  vendidas, disponibles y bloqueadas.
- **Panel de la Empresa Revendedora:** **100% responsive** (los Revendedores operan mayormente
  desde el celular) — panel completamente separado del de Operador Principal, ya que administra
  a las Empresas Revendedoras.
- **Alta de Cliente Final:** implementada como **wizard** (asistente paso a paso), no un formulario
  único. En la venta unitaria permite elegir servicios, con el servicio básico código 1 siempre
  incluido; la Cuenta completa recibe todos los servicios contratados.
- Aislamiento multi-tenant total entre Empresas Revendedoras (identificación por ID para soporte,
  sin acceso a datos sensibles entre sí; tampoco la Empresa Revendedora ve datos del Operador
  Principal).
- Panel de administración independiente por Empresa Revendedora (login propio).
- Parametrización de modalidad comercial y precios por parte del Operador Principal, incluyendo
  downgrade **y upgrade** de escala (potestad exclusiva del Operador Principal).
- Visualización de precios vigentes por parte de la Empresa Revendedora.
- Reporte de consumo/uso (licencias comprometidas vs. usadas) para permitir facturación manual
  externa al sistema.
- **Provisioning del primer Team Member root** del Operador Principal (vía seed, no vía panel —
  ver `02_Glosario_de_Actores_y_Entidades.md` y `04_Esqueleto_Tecnico_Inicial.md`, sección 4.6),
  para que Bruno pueda iniciar sesión con permisos totales apenas termine el desarrollo.
- **Registro de auditoría (Audit Log):** trazabilidad de altas/bajas/suspensiones de Cliente Final,
  cambios de modalidad comercial y de precios, con quién y cuándo (ver `03_Reglas_de_Negocio.md`,
  sección 11, y `04_Esqueleto_Tecnico_Inicial.md`, sección 1).
- **Visibilidad restringida por ID para el Operador Principal** sobre las Cuentas y Dispositivos de
  cada Empresa Revendedora (sin nombres ni datos de contacto de Clientes Finales — ver
  `03_Reglas_de_Negocio.md`, sección 4.2), dado que el Operador Principal también vende IPTV y no
  debe tener visibilidad comercial sobre la cartera de sus Empresas Revendedoras.
- **Panel de salud de la integración con SENSA** en el dashboard del Operador Principal (llamadas
  exitosas/fallidas recientes, cola de reintentos pendientes de BullMQ — ver
  `04_Esqueleto_Tecnico_Inicial.md`, sección 5).
- **Alerta de Cuenta cerca del tope global** (2 de 3 ventas/Dispositivos comerciales, sin contar
  reservas técnicas) en el panel de la Empresa Revendedora, para anticipar que una venta adicional
  puede requerir otra Cuenta compatible.
- **Exportación a CSV** de Clientes Finales y Dispositivos, disponible para la Empresa Revendedora,
  para facilitar la conciliación con su propio CRM/facturación externa (campo `id_gestion_externo`
  ya contemplado en el modelo de datos).

**Nota sobre puntos superados de este listado:** el mecanismo de "Dispositivos de reserva técnicos"
(marcado arriba) fue reemplazado por los contadores nativos de SENSA
(`auto_provision_count_mobile`/`auto_provision_count_stationary`), que IPTVControl sincroniza con la
cantidad de ventas activas de cada Cuenta. Además, el tope por venta unitaria pasó de "exactamente 1
Dispositivo" a "hasta 1 fijo + 1 móvil", y la Cuenta exclusiva pasó de un máximo global de 3 a hasta
3 fijos + 3 móviles (6 en total). Detalle completo y vigente en `03_Reglas_de_Negocio.md`, sección 2.

**Explícitamente fuera de alcance (primera etapa):**
- Facturación y cobranza (el sistema no emite ni gestiona pagos).
- Reasignación de un Dispositivo bloqueado por suspensión mientras el Cliente Final no pase a baja
  definitiva (no es un pendiente de roadmap, es una regla de negocio permanente).
- Soporte multi-proveedor (el conector a SENSA se diseña desacoplado, pero no se implementa
  ningún otro proveedor todavía).
- Modelo de licenciamiento del software a otros distribuidores (a definir).
- **API pública con API keys por Empresa Revendedora**, para integración directa sin pasar por el
  panel. **Decisión de arquitectura a favor para una fase 2** (no se implementa en el MVP, pero se
  documenta acá para que el diseño del backend no la bloquee — ver
  `04_Esqueleto_Tecnico_Inicial.md`, sección 8).

**Riesgo de negocio aceptado (no bloqueante, ver `03_Reglas_de_Negocio.md`, sección 6):**
Una nueva venta unitaria dentro de una Cuenta compartida no rota la contraseña de la Cuenta: el
Cliente Final nuevo recibe las mismas credenciales que tenía el cliente saliente, y los demás
Clientes Finales activos de esa Cuenta no son notificados. **Esta es una decisión de negocio ya
tomada por Bruno**, como parte del trade-off para lograr mayor rentabilidad operativa, no una
pregunta abierta.

## Documentos que forman parte de este Proyecto

1. `01_Instrucciones_del_Proyecto.md` (este documento)
2. `02_Glosario_de_Actores_y_Entidades.md`
3. `03_Reglas_de_Negocio.md`
4. `04_Esqueleto_Tecnico_Inicial.md`
5. Propuesta comercial SENSA (PDF adjunto — condiciones comerciales de referencia)
6. **Documentación de la API de SENSA** (adjunta como PDF — `API_Sensa_V4_1_3.pdf`)

## Datos de la empresa (para cotizaciones, informes o material formal derivado de este proyecto)

- **TECNOLOGIA ACTIVA S.A.S.** — CUIT 30-71600922-6 — Responsable Inscripto — Echeverría 1776 PB,
  Godoy Cruz, Mendoza — bruno.c@tecnologiaactiva.com.ar — 261-575-5355 — tecnologiaactiva.com.ar
- Diferenciador de venta: área de Investigación, Desarrollo e Innovación de Tecnología Activa,
  aplicable como argumento comercial en propuestas relacionadas a IPTVControl sin sonar exagerado.
