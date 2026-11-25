# HU-D02 — Autoasignar dispositivo con un único cliente activo

## Historia de usuario

**Como** Sistema  
**Quiero** asignar automáticamente un dispositivo nuevo cuando la cuenta tiene exactamente un cliente activo  
**Para** evitar intervención manual cuando no existe ambigüedad sobre su propietario

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

Extender el procesamiento de dispositivos no asociados para autoasignarlos solamente cuando la cuenta posee exactamente un Cliente Final activo.

## Reglas de negocio

- Aplica tanto a cuentas compartidas como exclusivas.
- Debe existir exactamente 1 cliente activo.
- Clientes dados de baja no cuentan.
- Si hay 0 clientes activos, no asignar.
- Si hay 2 o más clientes activos, no asignar.
- Reutilizar el mecanismo existente de asociación de dispositivo a cliente.
- Al resolver la asociación, cerrar/resolver el evento pendiente para detener recordatorios.

## Flujo esperado

1. Se detecta dispositivo sin cliente.
2. Se cuentan clientes activos de la cuenta.
3. Si el resultado es 1, se utiliza el flujo existente para asociarlo.
4. Se marca el evento como resuelto.
5. Se audita si el patrón actual del sistema audita este tipo de acciones.

## Criterios de aceptación

- [ ] Con 1 cliente activo el dispositivo se asocia automáticamente.
- [ ] Funciona en compartida y exclusiva.
- [ ] Un cliente dado de baja no impide la autoasignación al único cliente activo.
- [ ] Tras asociarse, no se generan más recordatorios por ese dispositivo.

## Dependencias

- HU-D01

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
