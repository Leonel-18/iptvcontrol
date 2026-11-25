# HU-N01 — Centro de notificaciones persistentes

## Historia de usuario

**Como** Usuario de Empresa Revendedora  
**Quiero** recibir y consultar notificaciones persistentes dentro del sistema  
**Para** no perder eventos relevantes aunque cierre sesión o cambie de pantalla

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

Crear un centro de notificaciones dentro de la aplicación, idealmente integrado en la navegación existente.

## Reglas de negocio

- Las notificaciones deben persistir en base de datos.
- Cada usuario tiene su propio estado leído/no leído.
- Todos los usuarios de una Empresa Revendedora reciben las notificaciones empresariales definidas.
- Marcar como leída es individual por usuario.
- Registrar quién marcó una notificación como leída y cuándo.
- Las notificaciones pueden tener acción contextual, por ejemplo `Ver cuenta`.
- Debe respetarse RLS y tenant.

## Flujo esperado

1. Se genera un evento notificable para una Empresa Revendedora.
2. Todos los usuarios correspondientes pueden verlo.
3. Cada uno mantiene su estado leído/no leído.
4. Un usuario abre o marca como leída.
5. Se registra la acción.
6. Otros usuarios conservan su propio estado.

## Criterios de aceptación

- [ ] Las notificaciones sobreviven logout/login.
- [ ] Dos usuarios del mismo tenant pueden tener distinto estado leído.
- [ ] No aparecen notificaciones de otros tenants.
- [ ] Se puede navegar a la entidad relacionada cuando aplique.
- [ ] Se registra usuario y fecha de lectura.

## Dependencias

- Sin dependencias funcionales adicionales.

## Fuera de alcance / No tocar

- Por ahora no implementar integraciones externas ni n8n.

## Consideraciones para la IA

- Inspeccionar primero los flujos y modelos existentes antes de crear estructuras nuevas.
- Reutilizar componentes, validaciones, jobs y mecanismos de auditoría ya existentes cuando corresponda.
- Mantener compatibilidad con el comportamiento actual salvo donde esta historia lo modifica explícitamente.
- No asumir decisiones no definidas en este documento.
