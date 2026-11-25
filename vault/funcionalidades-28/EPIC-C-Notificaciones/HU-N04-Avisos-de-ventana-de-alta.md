# HU-N04 — Avisos de ventana de alta por vencer

## Historia de usuario

**Como** Empresa Revendedora  
**Quiero** recibir avisos antes de que termine una ventana de alta  
**Para** poder actuar antes de que la cuenta vuelva a quedar disponible según las reglas actuales

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

Generar notificaciones para ventanas de alta vigentes próximas a vencer usando el mismo esquema de múltiples anticipaciones que las cuentas de prueba.

## Reglas de negocio

- Usar múltiples hitos en días, por ejemplo `[3,1]`.
- No enviar recordatorios repetidos fuera de esos hitos.
- No generar aviso si la ventana fue revocada o ya no está vigente.
- La notificación debe permitir ir a la cuenta.
- Respetar el comportamiento actual de ventana de alta; esta historia no redefine su lógica.

## Flujo esperado

1. Job detecta ventanas próximas a vencer.
2. Evalúa hitos configurados.
3. Crea notificación.
4. Usuario abre cuenta desde `Ver cuenta` si necesita intervenir.

## Criterios de aceptación

- [ ] No hay duplicados para el mismo hito.
- [ ] Una ventana revocada deja de generar avisos.
- [ ] La notificación identifica correctamente la cuenta.
- [ ] No se altera el mecanismo existente de ventana de alta.

## Dependencias

- HU-N01
- HU-N02

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
