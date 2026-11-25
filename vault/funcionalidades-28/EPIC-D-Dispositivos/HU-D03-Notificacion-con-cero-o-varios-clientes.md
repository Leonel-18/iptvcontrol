# HU-D03 — Notificar dispositivo con cero o varios clientes activos

## Historia de usuario

**Como** Usuario de Empresa Revendedora  
**Quiero** ser avisado cuando un dispositivo nuevo no puede autoasignarse de forma segura  
**Para** revisar la cuenta y resolverlo mediante los flujos existentes

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

Generar dos variantes funcionales de notificación cuando la autoasignación no sea segura.

## Reglas de negocio

Caso A — 0 clientes activos:
- No asignar el dispositivo.
- Crear notificación específica indicando que existe un dispositivo sin cliente activo asociado en esa cuenta.
- Incluir acción `Ver cuenta`.

Caso B — 2 o más clientes activos:
- No asignar el dispositivo.
- Crear notificación indicando que se detectó un dispositivo nuevo y existe ambigüedad de propietario.
- Incluir acción `Ver cuenta`.

Reglas generales:
- Todos los usuarios de la Empresa Revendedora reciben la notificación.
- No agregar desde la notificación un nuevo flujo de asignación manual.
- La pantalla de cuenta y el flujo existente de alta/asignación no deben modificarse para resolver esta historia.

## Flujo esperado

1. Se detecta dispositivo sin asociación.
2. Se cuentan clientes activos.
3. Con 0, genera notificación específica.
4. Con 2+, genera notificación de ambigüedad.
5. Usuario pulsa `Ver cuenta`.
6. Desde allí utiliza los mecanismos ya existentes del sistema.

## Criterios de aceptación

- [ ] Con 0 clientes activos nunca hay autoasignación.
- [ ] Con 2+ clientes activos nunca hay autoasignación.
- [ ] Los mensajes distinguen ambos escenarios.
- [ ] Ambas notificaciones incluyen `Ver cuenta`.
- [ ] No se crea un botón de asignación directa desde la notificación.
- [ ] No se modifica el flujo existente de alta/asignación.

## Dependencias

- HU-D01
- HU-N01

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
