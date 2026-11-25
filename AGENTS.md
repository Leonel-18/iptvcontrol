# IPTVControl

Sistema multi-tenant de gestión de cuentas IPTV.

## Reglas obligatorias

- Backend: español.
- Frontend: inglés.
- PostgreSQL usa RLS para aislamiento multi-tenant.
- Prisma debe trabajar con `app.current_tenant`.
- Toda integración con proveedores pasa por `ProveedorAdapter`.
- No llamar directamente a SENSA desde lógica de negocio.
- No asumir decisiones no documentadas.

## Uso de contexto

Antes de explorar código:

1. Usar Graphify:
   - `graphify query "<concepto>"`
   - `graphify explain "<símbolo>"`
2. Antes de modificar código compartido:
   - `graphify affected "<símbolo>"`
3. Leer únicamente los archivos necesarios.
4. No recorrer el repositorio completo.
5. No releer archivos salvo que sea necesario.
6. Después de cambios relevantes:
   - `graphify update .`

Si Graphify no alcanza, leer el archivo específico.

## Fuentes de verdad

Consultar solo cuando la tarea lo requiera:

- Alcance: `docs/01_Instrucciones_del_Proyecto.md`
- Glosario: `docs/02_Glosario_de_Actores_y_Entidades.md`
- Reglas de negocio: `docs/03_Reglas_de_Negocio.md`
- Arquitectura: `docs/04_Esqueleto_Tecnico_Inicial.md`
- Decisiones pendientes: `docs/05_Decisiones_Pendientes.md`
- Routing frontend: `docs/IPTVControl_URL_Routing_Convention.md`
- API SENSA: `docs/API_Sensa_V4_1_3.pdf`

No cargar estos documentos completos salvo que sean necesarios.

## Ejecución

- Realizar cambios mínimos.
- No usar agentes secundarios para tareas simples.
- No investigar alternativas si existe una solución clara.
- No generar documentación adicional salvo que se solicite.
- Evitar explicaciones extensas.

## Respuesta final

-> Decisión tomada
-> Cambios a realizar
-> Resumen del trabajo

Respuesta corta y directa.