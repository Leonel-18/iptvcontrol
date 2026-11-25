# HU-P04 — Tags de cuenta de prueba

## Historia de usuario

**Como** Usuario de Empresa Revendedora  
**Quiero** identificar claramente si una cuenta de prueba es compartida o exclusiva  
**Para** entender su modalidad y temporalidad sin abrir el detalle

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

Extender tags/estados visuales para representar:
- `Compartida - Prueba`
- `Exclusiva - Prueba`

Debe aparecer en las vistas equivalentes donde hoy se muestran modalidades de cuenta.

## Reglas de negocio

- La condición `Prueba` no reemplaza la modalidad base.
- `Prueba` nunca se muestra simultáneamente con `Aislada`.
- Al convertir a permanente, el tag pasa a `Compartida` o `Exclusiva` según corresponda.

## Flujo esperado

1. Backend expone modalidad base y condición de prueba.
2. Frontend compone tag correspondiente.
3. Al convertir/eliminar la prueba, la visualización se actualiza.

## Criterios de aceptación

- [ ] Una prueba compartida se ve como `Compartida - Prueba`.
- [ ] Una prueba exclusiva se ve como `Exclusiva - Prueba`.
- [ ] Nunca se muestra `Aislada - Prueba`.
- [ ] Al convertir a permanente desaparece el tag `Prueba`.

## Dependencias

- HU-P03

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
