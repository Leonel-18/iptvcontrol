# IPTVControl — Historias de usuario: Aislamiento, Cuentas de Prueba, Notificaciones y Dispositivos

Este paquete divide el trabajo funcional en historias pequeñas para implementación incremental por IA.

## Orden recomendado de implementación

### Épica A — Aislamiento
1. `EPIC-A-Aislamiento/HU-A01-Crear-cuenta-compartida-aislada.md`
2. `EPIC-A-Aislamiento/HU-A02-Aislar-cuenta-compartida-existente.md`
3. `EPIC-A-Aislamiento/HU-A03-Vencimiento-y-revocacion-de-aislamiento.md`
4. `EPIC-A-Aislamiento/HU-A04-Tags-y-visualizacion-de-aislamiento.md`

### Épica B — Cuentas de prueba
1. `EPIC-B-Cuentas-Prueba/HU-P01-Habilitacion-y-parametrizacion-por-revendedor.md`
2. `EPIC-B-Cuentas-Prueba/HU-P02-Cupo-mensual-y-cuentas-extra.md`
3. `EPIC-B-Cuentas-Prueba/HU-P03-Crear-cuenta-de-prueba.md`
4. `EPIC-B-Cuentas-Prueba/HU-P04-Tags-de-cuenta-de-prueba.md`
5. `EPIC-B-Cuentas-Prueba/HU-P05-Convertir-prueba-a-permanente.md`
6. `EPIC-B-Cuentas-Prueba/HU-P06-Vencimiento-automatico-de-prueba.md`
7. `EPIC-B-Cuentas-Prueba/HU-P07-Auditoria-de-cuentas-de-prueba.md`

### Épica C — Notificaciones
1. `EPIC-C-Notificaciones/HU-N01-Centro-de-notificaciones.md`
2. `EPIC-C-Notificaciones/HU-N02-Configuracion-de-notificaciones.md`
3. `EPIC-C-Notificaciones/HU-N03-Avisos-de-cuentas-de-prueba.md`
4. `EPIC-C-Notificaciones/HU-N04-Avisos-de-ventana-de-alta.md`
5. `EPIC-C-Notificaciones/HU-N05-Preferencias-de-usuario-y-sonido.md`

### Épica D — Dispositivos
1. `EPIC-D-Dispositivos/HU-D01-Deteccion-de-dispositivos-no-asignados.md`
2. `EPIC-D-Dispositivos/HU-D02-Autoasignacion-con-un-unico-cliente-activo.md`
3. `EPIC-D-Dispositivos/HU-D03-Notificacion-con-cero-o-varios-clientes.md`
4. `EPIC-D-Dispositivos/HU-D04-Recordatorios-de-dispositivos-pendientes.md`

## Reglas transversales cerradas

- Aislamiento y prueba nunca pueden coexistir en una misma cuenta.
- El aislamiento aplica solamente a cuentas compartidas.
- Una cuenta existente solo puede aislarse si tiene exactamente un cliente activo.
- Al terminar o revocar el aislamiento, la cuenta vuelve a `Compartida` sin ventana de alta.
- Las cuentas de prueba pueden ser compartidas o exclusivas.
- Convertir una prueba en permanente no devuelve el cupo mensual consumido.
- La duración configurada para pruebas afecta solo a nuevas cuentas.
- El extra de cuentas de prueba corresponde únicamente al período mensual actual.
- Las cuentas de prueba se eliminan automáticamente al vencer, pero el cliente no se elimina: queda como cliente sin cuenta.
- Toda baja/cierre debe seguir el flujo tradicional existente del sistema y cualquier operación externa debe pasar por `ProveedorAdapter`.
- Las notificaciones son persistentes y por usuario; se registra quién las marca como leídas.
- Los recordatorios de dispositivo continúan mientras el evento siga pendiente.
- Un dispositivo nuevo se autoasigna solo cuando existe exactamente un cliente activo asociado a la cuenta.
