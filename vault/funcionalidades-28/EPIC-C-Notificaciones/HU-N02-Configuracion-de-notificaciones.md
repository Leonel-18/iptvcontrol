# HU-N02 — Configuración de notificaciones

## Historia de usuario

**Como** Empresa Revendedora  
**Quiero** configurar cuándo y con qué anticipación recibir avisos  
**Para** adaptar la frecuencia de recordatorios a su operación

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

Agregar configuración de notificaciones en el apartado `Configuración`, estructurada de forma ordenada, preferentemente mediante solapas/secciones si la UI existente lo admite.

## Reglas de negocio

Debe permitir configurar al menos:
- avisos de dispositivos pendientes;
- avisos de ventana de alta próxima a vencer;
- anticipaciones de cuentas de prueba cuando corresponda según parametrización definida;
- múltiples anticipaciones en días para vencimientos, por ejemplo `[7,3,1]`;
- frecuencia de recordatorio de dispositivos pendientes.

Para eventos de dispositivo:
- la frecuencia define cada cuánto recordar mientras el evento siga sin resolver;
- no debe duplicarse una nueva notificación por cada ejecución del cron.

Para vencimientos:
- usar múltiples hitos de anticipación, no spam periódico.

## Flujo esperado

1. Usuario abre Configuración.
2. Ingresa o modifica preferencias.
3. Sistema valida valores.
4. Guarda configuración por tenant.
5. Jobs/notificaciones consultan esa configuración al generar avisos.

## Criterios de aceptación

- [ ] La configuración es independiente por Empresa Revendedora.
- [ ] Permite múltiples días de anticipación.
- [ ] La frecuencia de dispositivos se interpreta como recordatorio del mismo evento pendiente.
- [ ] Los cambios no afectan otros tenants.
- [ ] No se generan duplicados por cada barrido.

## Dependencias

- HU-N01

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
