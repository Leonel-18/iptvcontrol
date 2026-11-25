# HU-P06 — Vencimiento automático de cuenta de prueba

## Historia de usuario

**Como** Sistema  
**Quiero** cerrar automáticamente una cuenta de prueba cuando alcanza su fecha límite  
**Para** evitar que una prueba permanezca activa fuera del período autorizado

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

Implementar procesamiento automático de vencimientos de cuentas de prueba.

Debe reutilizar el flujo tradicional de cierre/borrado de cuenta ya existente en el sistema.

## Reglas de negocio

- Al vencer, la cuenta se cierra siguiendo el comportamiento tradicional existente.
- Debe ejecutarse también la baja/cierre correspondiente en SENSA mediante `ProveedorAdapter`.
- El Cliente Final NO se elimina ni se da de baja.
- El cliente queda como `cliente sin cuenta`.
- Si la operación externa falla, no se debe marcar localmente como cerrada de forma inconsistente.
- Registrar el error y permitir/reintentar el procesamiento.
- El job debe ser idempotente.
- El cierre automático no devuelve cupo mensual.
- La auditoría debe identificar al sistema como ejecutor.

## Flujo esperado

1. Job obtiene pruebas vencidas activas.
2. Para cada una ejecuta el flujo estándar de cierre.
3. Si proveedor responde correctamente, actualiza estado local.
4. Desvincula la cuenta del cliente sin eliminar el cliente.
5. Registra auditoría.
6. Si falla proveedor, conserva estado coherente, registra error y deja pendiente reintento.

## Criterios de aceptación

- [ ] Una prueba vencida se cierra automáticamente.
- [ ] El cliente sigue existiendo.
- [ ] El cliente queda sin cuenta.
- [ ] SENSA se opera solo vía `ProveedorAdapter`.
- [ ] Un fallo externo no deja la cuenta falsamente cerrada localmente.
- [ ] El proceso soporta reintentos.
- [ ] No devuelve cupo mensual.
- [ ] La acción queda auditada como sistema.

## Dependencias

- HU-P03
- HU-P07

## Fuera de alcance / No tocar

- No crear un flujo nuevo de baja si el proyecto ya posee uno válido; reutilizarlo.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
