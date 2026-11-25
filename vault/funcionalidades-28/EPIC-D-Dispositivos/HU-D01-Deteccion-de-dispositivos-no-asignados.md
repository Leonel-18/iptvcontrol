# HU-D01 — Detección de dispositivos no asignados

## Historia de usuario

**Como** Sistema  
**Quiero** identificar dispositivos que aparecen en una cuenta pero no están asociados a un Cliente Final  
**Para** poder resolver automáticamente o notificar según la cantidad de clientes activos

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

Reutilizar el barrido/cron existente de dispositivos y enriquecer su comportamiento cuando encuentra un dispositivo perteneciente a una cuenta pero sin asociación a cliente.

## Reglas de negocio

- No reemplazar el mecanismo de detección existente si ya funciona.
- Cada dispositivo detectado sin cliente debe convertirse en un evento pendiente identificable.
- Evitar generar un evento nuevo idéntico en cada barrido.
- La resolución depende de la cantidad de clientes activos de la cuenta.
- Clientes dados de baja no cuentan.

## Flujo esperado

1. Cron/barrido detecta dispositivo nuevo no asociado.
2. Identifica cuenta.
3. Cuenta clientes activos.
4. Deriva a autoasignación o notificación según historias siguientes.
5. Mantiene un único evento pendiente por dispositivo/cuenta mientras no se resuelva.

## Criterios de aceptación

- [ ] Un mismo dispositivo no genera eventos duplicados por cada cron.
- [ ] El sistema distingue clientes activos de clientes dados de baja.
- [ ] El evento queda asociado a la cuenta correcta.
- [ ] No se altera innecesariamente el barrido existente.

## Dependencias

- HU-N01

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
