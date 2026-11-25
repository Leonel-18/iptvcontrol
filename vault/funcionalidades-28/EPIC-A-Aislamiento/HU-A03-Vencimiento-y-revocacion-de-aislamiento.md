# HU-A03 — Vencimiento y revocación de aislamiento

## Historia de usuario

**Como** Empresa Revendedora  
**Quiero** permitir que el aislamiento termine automáticamente o pueda revocarse antes  
**Para** devolver la cuenta a la operatoria compartida normal cuando ya no sea necesario

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

Implementar el fin del aislamiento por dos vías: vencimiento automático o revocación manual.

En ambos casos el resultado debe ser el mismo.

## Reglas de negocio

- Al finalizar el aislamiento, la cuenta pasa a `Compartida`.
- No debe crearse ni restaurarse una ventana de alta.
- Desde ese momento la cuenta puede volver a recibir nuevos clientes según la lógica normal.
- La revocación manual puede realizarse antes de la fecha de vencimiento.
- El proceso automático debe ser idempotente.
- La acción debe auditarse indicando si fue manual o automática.

## Flujo esperado

Vencimiento automático:
1. Job detecta aislamiento vencido.
2. Remueve condición de aislamiento.
3. Mantiene la cuenta compartida.
4. No crea ventana de alta.
5. Registra auditoría como acción del sistema.

Revocación manual:
1. Usuario selecciona `Quitar aislamiento`.
2. Sistema solicita confirmación.
3. Remueve aislamiento inmediatamente.
4. Mantiene cuenta compartida sin ventana de alta.
5. Registra usuario en auditoría.

## Criterios de aceptación

- [ ] Al vencer, la cuenta deja de figurar como aislada.
- [ ] Al revocar manualmente ocurre exactamente el mismo cambio funcional.
- [ ] No aparece una nueva ventana de alta.
- [ ] La cuenta vuelve a ser elegible para nuevos clientes.
- [ ] El job puede ejecutarse nuevamente sin duplicar efectos.
- [ ] Auditoría diferencia usuario vs sistema.

## Dependencias

- HU-A01
- HU-A02

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
