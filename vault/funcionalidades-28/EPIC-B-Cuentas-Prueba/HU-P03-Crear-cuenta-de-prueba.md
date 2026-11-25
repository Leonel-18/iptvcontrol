# HU-P03 — Crear cuenta de prueba

## Historia de usuario

**Como** Empresa Revendedora  
**Quiero** crear una cuenta de prueba compartida o exclusiva  
**Para** permitir una prueba temporal bajo las condiciones definidas por el Operador Principal

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

Agregar una acción de creación de cuenta de prueba dentro del flujo de alta correspondiente.

La Empresa Revendedora no parametriza la duración: la recibe de su configuración.

## Reglas de negocio

- Requiere módulo de pruebas habilitado.
- Requiere cupo disponible.
- Puede ser `Compartida - Prueba` o `Exclusiva - Prueba`.
- No puede coexistir con aislamiento.
- La duración sale de la configuración vigente al momento de crear.
- Persistir fecha de creación de prueba y fecha exacta de vencimiento.
- Cambios futuros de configuración no alteran ese vencimiento.
- La cuenta debe crearse con el flujo normal del sistema.
- La validación global existente de Cliente Final por documento/teléfono no debe ser duplicada ni reimplementada.
- Consumir una prueba incrementa el contador mensual.

## Flujo esperado

1. Usuario inicia alta.
2. Selecciona cuenta de prueba.
3. Selecciona modalidad compartida o exclusiva.
4. Backend valida habilitación y cupo.
5. Obtiene duración actual configurada.
6. Crea la cuenta y asocia al cliente.
7. Persiste fechas de prueba.
8. Incrementa consumo mensual.
9. Registra auditoría.

## Criterios de aceptación

- [ ] No se puede crear prueba si el módulo está deshabilitado.
- [ ] No se puede crear prueba sin cupo disponible.
- [ ] Puede crearse como compartida o exclusiva.
- [ ] La Empresa Revendedora no puede elegir la duración.
- [ ] El vencimiento queda congelado al momento de creación.
- [ ] El consumo mensual aumenta una sola vez.
- [ ] No se crea aislamiento sobre la misma cuenta.

## Dependencias

- HU-P01
- HU-P02

## Fuera de alcance / No tocar

- No modificar comportamientos ajenos a esta historia.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
