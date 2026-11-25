# HU-A02 — Aislar cuenta compartida existente

## Historia de usuario

**Como** Empresa Revendedora  
**Quiero** aislar una cuenta compartida ya existente  
**Para** evitar temporalmente que nuevos clientes sean asignados a esa cuenta

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

Agregar una acción de aislamiento sobre cuentas compartidas existentes.

La acción solo debe estar disponible cuando la cuenta tenga exactamente un Cliente Final activo.

## Reglas de negocio

- Solo puede aislarse una cuenta compartida.
- Debe existir exactamente un cliente activo asociado.
- Clientes dados de baja no cuentan para esta validación.
- Si existe una ventana de alta vigente, debe eliminarse/revocarse y reemplazarse por el aislamiento.
- Se solicita una cantidad de días mayor que 0.
- Aislamiento y prueba son mutuamente excluyentes.
- No modificar dispositivos, reservas o cupos técnicos.

## Flujo esperado

1. Usuario abre una cuenta compartida.
2. El sistema valida cantidad de clientes activos.
3. Si existe exactamente uno, habilita la acción `Aislar`.
4. Usuario ingresa días.
5. El sistema revoca cualquier ventana de alta existente.
6. Marca la cuenta como aislada y calcula vencimiento.
7. Registra auditoría.

## Criterios de aceptación

- [ ] No se puede aislar una cuenta exclusiva.
- [ ] No se puede aislar una cuenta con 0 clientes activos.
- [ ] No se puede aislar una cuenta con 2 o más clientes activos.
- [ ] No se puede aislar una cuenta de prueba.
- [ ] Si había ventana de alta, deja de estar vigente.
- [ ] La cuenta bloquea nuevos clientes durante el aislamiento.
- [ ] La operación queda auditada.

## Dependencias

- HU-A01

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
