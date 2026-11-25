# HU-N03 — Avisos de cuentas de prueba por vencer

## Historia de usuario

**Como** Empresa Revendedora  
**Quiero** recibir varios avisos antes de que venza una cuenta de prueba  
**Para** decidir a tiempo si convertirla a permanente o dejar que finalice

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

Generar notificaciones según las anticipaciones configuradas para cada Empresa Revendedora respecto de sus cuentas de prueba.

## Reglas de negocio

- Soportar múltiples anticipaciones, por ejemplo 7, 3 y 1 día antes.
- Un mismo hito no debe notificarse dos veces al mismo usuario.
- Todos los usuarios de la Empresa Revendedora reciben el aviso.
- La notificación debe permitir ir a la cuenta.
- Desde la cuenta el usuario puede convertirla a permanente.
- Si no se toma acción, el vencimiento automático sigue su curso.
- Si la prueba ya fue convertida o cerrada, no generar avisos futuros.

## Flujo esperado

1. Job calcula pruebas próximas a vencer.
2. Compara con hitos configurados.
3. Genera notificación correspondiente.
4. Usuario puede abrir `Ver cuenta`.
5. Si convierte la cuenta, se cancelan hitos pendientes.

## Criterios de aceptación

- [ ] Se generan avisos exactamente en los hitos configurados.
- [ ] No hay duplicados del mismo hito.
- [ ] Una prueba convertida deja de generar avisos.
- [ ] Una prueba cerrada deja de generar avisos.
- [ ] El enlace `Ver cuenta` dirige al detalle correcto.

## Dependencias

- HU-P03
- HU-P05
- HU-N01
- HU-N02

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
