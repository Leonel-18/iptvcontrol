# HU-N05 — Preferencias de usuario y sonido

## Historia de usuario

**Como** Usuario del sistema  
**Quiero** activar o desactivar el sonido de nuevas notificaciones  
**Para** adaptar la experiencia a su preferencia personal

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

Agregar una preferencia individual de usuario para sonido de notificaciones internas.

## Reglas de negocio

- La preferencia es por usuario, no por Empresa Revendedora.
- Debe persistir.
- El sonido es opcional.
- No modificar la generación de notificaciones; solo su presentación al usuario.
- Respetar restricciones del navegador para reproducción de audio.

## Flujo esperado

1. Usuario abre preferencias.
2. Activa/desactiva sonido.
3. Se persiste la selección.
4. Cuando llega una nueva notificación visible para ese usuario, el frontend reproduce sonido solo si corresponde y el navegador lo permite.

## Criterios de aceptación

- [ ] Dos usuarios de la misma empresa pueden tener configuraciones diferentes.
- [ ] La preferencia se conserva entre sesiones.
- [ ] Desactivar sonido no impide recibir notificaciones.
- [ ] No se fuerza audio si el navegador lo bloquea.

## Dependencias

- HU-N01

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
