# HU-D04 — Recordatorios de dispositivos pendientes

## Historia de usuario

**Como** Empresa Revendedora  
**Quiero** recibir recordatorios periódicos mientras un dispositivo siga sin asociarse  
**Para** evitar que un evento pendiente quede olvidado sin generar spam en cada barrido

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

Implementar recordatorios sobre el mismo evento de dispositivo pendiente según la frecuencia configurada por la Empresa Revendedora.

## Reglas de negocio

- La frecuencia no modifica el cron de detección.
- No crear una notificación nueva en cada barrido.
- Mantener un evento pendiente único.
- Cada cierto intervalo configurado, generar/renovar el recordatorio correspondiente.
- Cuando el dispositivo quede asociado a un cliente, el evento se considera resuelto y cesan los recordatorios.
- La resolución puede ocurrir por autoasignación o por el flujo manual existente.

## Flujo esperado

1. Existe evento pendiente de dispositivo.
2. Sistema revisa última notificación/recordatorio.
3. Si alcanzó la frecuencia configurada y sigue pendiente, emite recordatorio.
4. Si el dispositivo ya está asociado, marca resuelto y no vuelve a avisar.

## Criterios de aceptación

- [ ] Cambiar la frecuencia no altera el cron de detección.
- [ ] No existe spam por cada barrido.
- [ ] El mismo evento puede generar recordatorios mientras siga pendiente.
- [ ] Al asociarse el dispositivo, los recordatorios se detienen.
- [ ] La configuración es por Empresa Revendedora.

## Dependencias

- HU-D01
- HU-D02
- HU-D03
- HU-N02

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
