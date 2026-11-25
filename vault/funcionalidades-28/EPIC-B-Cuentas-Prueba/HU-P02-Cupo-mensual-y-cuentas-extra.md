# HU-P02 — Cupo mensual y cuentas extra

## Historia de usuario

**Como** Operador Principal  
**Quiero** limitar cuántas cuentas de prueba puede consumir cada Empresa Revendedora por mes  
**Para** controlar el beneficio mensual sin que borrar o convertir una prueba devuelva cupo

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

Implementar conteo mensual de cuentas de prueba consumidas, reutilizando el patrón de conteos mensuales ya existente en el proyecto si corresponde.

## Reglas de negocio

- El contador mide cuentas de prueba creadas durante el período, no cuentas actualmente activas.
- El período es mensual y se reinicia siguiendo el mismo criterio de los conteos mensuales existentes.
- Si el cupo es 15 y ya se crearon 15, no se puede crear una 16 aunque alguna haya sido eliminada o convertida.
- Convertir una prueba a permanente no devuelve cupo.
- Borrar/cerrar una prueba no devuelve cupo.
- Los extras pertenecen únicamente al mes/período actual.
- Al nuevo período, el extra anterior deja de aplicar.
- El Operador Principal puede aumentar o disminuir el cupo durante el período.
- Si se reduce por debajo del consumo actual, no se elimina nada; simplemente queda disponible 0 hasta el siguiente período o hasta aumentar el cupo.
- Si se aumenta, la diferencia queda disponible inmediatamente.

## Flujo esperado

Ejemplo:
- Cupo: 15
- Extras: 3
- Total disponible del período: 18
- Consumidas: 18
- Activas actualmente: 8
- Disponible para crear: 0

Al nuevo período:
- Consumidas: 0
- Extras: 0
- Cupo base: se conserva.

## Criterios de aceptación

- [ ] El sistema bloquea la creación al alcanzar `cupo + extras`.
- [ ] Borrar una prueba no reduce el consumo.
- [ ] Convertir una prueba no reduce el consumo.
- [ ] Aumentar cupo habilita disponibilidad inmediata.
- [ ] Reducir cupo no afecta pruebas existentes.
- [ ] Extras no se arrastran al siguiente mes.
- [ ] El contador se calcula por Empresa Revendedora.

## Dependencias

- HU-P01

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
