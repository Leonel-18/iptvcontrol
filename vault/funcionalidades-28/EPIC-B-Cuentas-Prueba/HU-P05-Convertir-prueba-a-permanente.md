# HU-P05 — Convertir cuenta de prueba a permanente

## Historia de usuario

**Como** Empresa Revendedora  
**Quiero** convertir una cuenta de prueba existente en una cuenta permanente  
**Para** conservar la misma cuenta y evitar su eliminación automática

## Contexto obligatorio del proyecto

- IPTVControl es un sistema multi-tenant.
- Backend en español y frontend en inglés.
- PostgreSQL utiliza RLS y Prisma debe respetar `app.current_tenant`.
- Toda operación contra el proveedor debe pasar por `ProveedorAdapter`.
- No llamar directamente a SENSA desde lógica de negocio.
- Antes de modificar código compartido, revisar impacto con Graphify y reutilizar patrones existentes.
- Realizar cambios mínimos y no inventar reglas no documentadas.
- Las acciones relevantes deben integrarse con el módulo de auditoría existente.


## Alcance

Agregar una acción dentro del detalle de cuenta de prueba para convertirla en permanente.

La IA debe ubicar el botón donde mejor encaje con la UI existente, sin rediseñar innecesariamente la pantalla.

## Reglas de negocio

- No se crea una cuenta nueva.
- Se conserva la misma cuenta, cliente, credenciales y dispositivos.
- Se elimina la condición de prueba y su vencimiento automático.
- El cupo mensual consumido NO se devuelve.
- Si la cuenta es compartida, se puede agregar opcionalmente una ventana de alta.
- Si no se agrega ventana, queda como `Compartida` normal y puede recibir nuevos clientes según la lógica actual.
- Si es exclusiva, pasa directamente a `Exclusiva`.
- La conversión debe ser auditada.

## Flujo esperado

1. Usuario abre cuenta de prueba.
2. Selecciona `Convertir a permanente`.
3. Si es compartida, el sistema ofrece ventana de alta opcional.
4. Usuario confirma.
5. Se remueve condición de prueba y vencimiento.
6. Se conserva identidad de la cuenta.
7. Se registra auditoría.

## Criterios de aceptación

- [ ] No cambia el identificador de cuenta.
- [ ] No se crea una segunda cuenta externa.
- [ ] Deja de ser elegible para autoeliminación por vencimiento.
- [ ] El contador mensual consumido permanece igual.
- [ ] En compartida, la ventana de alta es opcional.
- [ ] En exclusiva no se solicita ventana de alta.
- [ ] Se actualiza el tag correctamente.

## Dependencias

- HU-P03
- HU-P04

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
