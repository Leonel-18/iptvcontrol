# HU-A01 — Crear cuenta compartida aislada

## Historia de usuario

**Como** Empresa Revendedora  
**Quiero** crear un Cliente Final con modalidad compartida y aislamiento en días  
**Para** garantizar que ese cliente tenga temporalmente una cuenta compartida nueva sin que ingresen otros clientes

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

Modificar el flujo de alta de Cliente Final para que la elección de aislamiento se realice antes de resolver la cuenta destino.

Cuando se seleccione `Compartida - Aislada`, el sistema no debe reutilizar una cuenta compartida existente aunque tenga capacidad disponible. Debe crear una cuenta nueva mediante el flujo normal y aplicar un período de aislamiento expresado exclusivamente en días.

## Reglas de negocio

- Solo aplica a modalidad compartida.
- El aislamiento se parametriza con un único valor entero de días.
- No se permiten horas.
- El valor debe ser mayor que 0.
- Una cuenta aislada no puede ser simultáneamente cuenta de prueba.
- Durante el aislamiento no pueden ingresar nuevos clientes a la cuenta.
- La creación de la cuenta debe seguir el mecanismo actual y cualquier interacción con SENSA debe pasar por `ProveedorAdapter`.
- El aislamiento reemplaza conceptualmente a la ventana de alta para este caso.

## Flujo esperado

1. Usuario inicia alta de Cliente Final.
2. Selecciona modalidad `Compartida`.
3. Selecciona opción de aislamiento.
4. Ingresa cantidad de días.
5. El sistema crea una cuenta compartida nueva.
6. Asocia el cliente a esa cuenta.
7. Marca la cuenta como `Compartida - Aislada`.
8. Calcula y persiste fecha de fin de aislamiento.
9. Registra la acción en auditoría.

## Criterios de aceptación

- [ ] Al elegir aislamiento desaparece la configuración de ventana de alta y aparece un único input de días.
- [ ] El sistema rechaza valores 0, negativos o no enteros.
- [ ] Nunca se reutiliza una cuenta compartida existente para un alta aislada.
- [ ] La cuenta resultante queda identificada como `Compartida - Aislada`.
- [ ] Ningún segundo cliente puede ser incorporado mientras el aislamiento esté vigente.
- [ ] El alta queda auditada.

## Dependencias

- Sin dependencias funcionales adicionales.

## Fuera de alcance / No tocar

- No modificar la capacidad comercial máxima de dispositivos.
- No tocar reservas técnicas de dispositivos por el solo hecho de aislar una cuenta.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
