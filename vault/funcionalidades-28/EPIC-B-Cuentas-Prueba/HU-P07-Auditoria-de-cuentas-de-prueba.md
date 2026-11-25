# HU-P07 — Auditoría del ciclo de cuentas de prueba

## Historia de usuario

**Como** Operador autorizado  
**Quiero** consultar en el módulo de auditoría las acciones relevantes de cuentas de prueba  
**Para** poder reconstruir qué ocurrió, cuándo y quién lo ejecutó

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

Integrar los eventos de cuentas de prueba con el módulo de auditoría existente. No crear un segundo sistema de logs funcionales.

## Reglas de negocio

Auditar al menos:
- creación de prueba;
- modificación relevante de configuración por Operador Principal;
- conversión a permanente;
- cierre manual;
- cierre automático por vencimiento;
- fallo de cierre automático cuando corresponda;
- actor: usuario o sistema;
- fecha/hora;
- identificador de la cuenta y tenant correspondiente.

## Flujo esperado

Cada operación relevante emite el evento usando el mecanismo de auditoría actual del proyecto.

## Criterios de aceptación

- [ ] Se puede distinguir creación, conversión y cierre.
- [ ] Se identifica usuario cuando la acción fue manual.
- [ ] Se identifica sistema cuando fue automática.
- [ ] Los registros respetan aislamiento multi-tenant.
- [ ] No se crea un módulo paralelo de auditoría.

## Dependencias

- HU-P01

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
