---
tags: [negocio, capacidad, fase-2]
deriva-de: docs/03_Reglas_de_Negocio.md (sección 15)
implementado-en: backend/src/modules/cuentas/ventanas-curiosidad.service.ts · frontend/src/features/accounts/CuriosityWindowPanel.tsx · frontend/src/features/settings/CuriosityWindowSettings.tsx
---

# Ventana de curiosidad (Fase 2)

Restricción **local** de IPTVControl (no un mecanismo de SENSA) que reduce la ventana de tiempo en
la que un "cliente curioso" — alguien que compró sólo para mirar las credenciales o el contenido —
puede pasarle el usuario/contraseña a otra persona antes de que la Empresa Revendedora note algo
raro.

No reemplaza el [[Riesgo aceptado - contraseña compartida|riesgo aceptado de credenciales
compartidas sin rotación]]: sigue existiendo. Sólo acorta la ventana de exposición para un Cliente
Final **nuevo** después de cada venta que entra a una Cuenta compartida.

## Alcance

- Sólo [[Capacidad de una Cuenta|Cuentas compartidas]]. Las exclusivas nunca se bloquean.
- **Nunca bloquea al dueño** de la venta que abrió la ventana: puede seguir vinculando sus propios
  Dispositivos (1+1 o 2+2) sin restricción.
- Bloquea únicamente que la Cuenta se le ofrezca a otro Cliente Final nuevo — por el buscador
  automático de [[Flujo - Alta de Cliente Final|alta]] y por la reasignación manual de un
  Dispositivo liberado ([[Flujo - Migración de Cuenta]]).
- No toca los contadores `auto_provision_count*` de SENSA: un cupo bloqueado por la ventana sigue
  contando como libre a esos efectos.

## Ciclo de vida

```mermaid
flowchart TD
    A["Venta nueva confirmada<br/>en una Cuenta compartida"] --> B["Abrir Ventana de curiosidad<br/>(duración ≤ predeterminado del Revendedor)"]
    B --> C{"¿Se consulta/usa<br/>la Cuenta de nuevo?"}
    C -->|"Antes del vencimiento"| D["Sigue bloqueada<br/>para clientes nuevos"]
    C -->|"Después del vencimiento"| E["Se recalcula al vuelo:<br/>vencida (sin job en segundo plano)"]
    D --> F{"¿Levantamiento manual?"}
    F -->|"Sí"| G["Fin real = ahora<br/>motivo: levantamiento_manual"]
    F -->|"No"| C

    classDef ok fill:#E9F9F0,stroke:#17B26A
    classDef alerta fill:#FDF5E4,stroke:#E8A93A
    class E ok
    class D alerta
```

- **Duración predeterminada:** cada Empresa Revendedora la define en `/settings` (días/horas/
  minutos; puede ser `0` = no usar la funcionalidad).
- **Override por venta:** el vendedor puede reducirla en el wizard de alta, nunca superarla. El
  backend valida el tope, no sólo el selector.
- **No retroactiva:** la duración que queda guardada es la vigente al momento de esa venta puntual.
  Cambiar el predeterminado después no afecta ventanas ya abiertas.
- **Vencimiento al vuelo:** no hay job en segundo plano. Cada consulta relevante (búsqueda de
  Cuenta, apertura de una nueva, vista de Cuenta) cierra primero las ventanas vencidas de esa
  Cuenta antes de decidir.
- **Levantamiento manual:** desde `/accounts/:id`, con confirmación y registro en el Audit Log
  (`levantamiento_ventana_curiosidad`).

## Historial

Cada Cuenta compartida conserva sus ventanas anteriores: inicio, fin previsto, fin real, duración
predeterminada vs. aplicada, quién la abrió y quién la levantó (si corresponde). Visible desde la
vista de Cuenta.

## Puntos de enforcement en el backend

Todos pasan por `VentanasCuriosidadService`, bajo el mismo advisory lock por Cuenta que ya usa
`CuentasProvisioningService` (ver [[Consistencia con el Proveedor]]):

- `buscarCuentaConLugar()` — excluye Cuentas con ventana activa de la búsqueda automática.
- `reservarCapacidadPorNuevaVenta()` — abre la ventana en la misma transacción que crea la venta.
- `reasignar()` de un Dispositivo liberado — llamada "otra forma de alta" (regla de negocio 6):
  si el cliente destino no tiene venta previa en esa Cuenta, se valida el mismo bloqueo
  (`asegurarClientePermitido`). **Pendiente:** este camino todavía no crea la fila de venta
  compartida correspondiente — ver `docs/05_Decisiones_Pendientes.md`, sección 4.
- Resolución de incidencias de Dispositivo no autorizado — misma reserva que un alta nueva.

## Ver también

- [[Capacidad de una Cuenta]]
- [[Flujo - Alta de Cliente Final]]
- [[Flujo - Migración de Cuenta]]
- [[Riesgo aceptado - contraseña compartida]]
