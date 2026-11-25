# HU-A04 — Tags y visualización de aislamiento

## Historia de usuario

**Como** Usuario de Empresa Revendedora  
**Quiero** identificar visualmente las cuentas y clientes vinculados a una cuenta aislada  
**Para** entender rápidamente el estado comercial de cada cuenta

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

Extender la representación visual existente de modalidad de cuenta para mostrar el estado `Compartida - Aislada` tanto en tabla de cuentas como en las vistas/tablas de clientes donde actualmente se indica `Compartida` o `Exclusiva`.

## Reglas de negocio

- No crear un estado ambiguo separado de la modalidad base.
- La cuenta sigue siendo compartida; el aislamiento es una condición adicional.
- Debe mostrarse de forma consistente en las vistas relevantes.
- No cambiar el comportamiento de cuentas exclusivas.

## Flujo esperado

1. Backend expone de forma consistente modalidad y condición de aislamiento.
2. Frontend muestra `Compartida - Aislada`.
3. Al finalizar/revocar aislamiento vuelve a mostrarse `Compartida`.

## Criterios de aceptación

- [ ] Tabla de cuentas identifica claramente `Compartida - Aislada`.
- [ ] Vista/listado de clientes refleja que el cliente está en una cuenta aislada.
- [ ] Al terminar aislamiento el tag se actualiza a `Compartida`.
- [ ] No se altera la visualización de cuentas exclusivas.

## Dependencias

- HU-A01
- HU-A03

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
