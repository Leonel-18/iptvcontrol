# HU-P01 — Habilitación y parametrización de cuentas de prueba por revendedor

## Historia de usuario

**Como** Operador Principal  
**Quiero** habilitar y parametrizar el módulo de cuentas de prueba para cada Empresa Revendedora  
**Para** comercializar y controlar esta funcionalidad por tenant

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

Agregar configuración por Empresa Revendedora para controlar el acceso al módulo de cuentas de prueba.

## Reglas de negocio

Configuración mínima:
- `Cuentas de prueba habilitadas`: Sí/No.
- `Cupo mensual`.
- `Duración de nuevas pruebas`: días.
- `Extras del período actual`.
- `Avisos previos al vencimiento`: múltiples valores en días.

Reglas:
- La funcionalidad puede estar deshabilitada por empresa.
- Cuando está deshabilitada, la Empresa Revendedora debe ver la opción/botón pero en estado disabled, para evidenciar que el módulo existe.
- No debe poder ejecutar la acción.
- La duración se aplica únicamente a nuevas cuentas de prueba.
- Cambiar la duración no recalcula vencimientos ya persistidos.
- Respetar aislamiento multi-tenant y no exponer datos comerciales de otros tenants.

## Flujo esperado

1. Operador Principal abre configuración de una Empresa Revendedora.
2. Habilita o deshabilita cuentas de prueba.
3. Configura cupo, duración y avisos.
4. Opcionalmente asigna extras para el período actual.
5. Sistema persiste parámetros.
6. Empresa Revendedora ve la acción habilitada o disabled según configuración.

## Criterios de aceptación

- [ ] Cada Empresa Revendedora tiene configuración independiente.
- [ ] Un tenant deshabilitado no puede crear pruebas aunque manipule el frontend.
- [ ] El botón sigue visible pero disabled cuando no tiene el módulo habilitado.
- [ ] Cambiar duración solo afecta nuevas pruebas.
- [ ] La configuración respeta RLS.
- [ ] Los cambios relevantes quedan auditados.

## Dependencias

- Sin dependencias funcionales adicionales.

## Fuera de alcance / No tocar

- No habilitar acceso cruzado entre Empresas Revendedoras.
- No ocultar completamente la funcionalidad cuando esté deshabilitada.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
