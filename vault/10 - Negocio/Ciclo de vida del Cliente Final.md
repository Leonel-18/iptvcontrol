---
tags: [negocio, ciclo-de-vida]
deriva-de: docs/03_Reglas_de_Negocio.md (sección 3)
implementado-en: backend/src/modules/clientes/clientes.service.ts
---

# Ciclo de vida del Cliente Final

La diferencia entre **suspender** y **dar de baja** no está en el cliente: está en **qué le pasa al
Dispositivo**. Es la regla que más consultas genera, así que conviene tenerla clara.

```mermaid
stateDiagram-v2
    [*] --> activo: Alta
    activo --> suspendido: Suspensión
    suspendido --> activo: Reactivación
    activo --> dado_de_baja: Baja definitiva
    suspendido --> dado_de_baja: Transición explícita
    dado_de_baja --> [*]

    note right of suspendido
        Dispositivo: bloqueado_por_suspension
        Liberado en SENSA, pero RESERVADO.
        Nadie más lo puede tomar.
    end note

    note right of dado_de_baja
        Dispositivo: disponible
        Liberado y reasignable a un
        Cliente Final nuevo.
    end note
```

## Qué hace el sistema en cada transición

| Transición | En el Proveedor | Estado del Dispositivo | ¿Otro cliente puede tomarlo? |
|---|---|---|---|
| **Alta** | Crea Cuenta o amplía capacidad, y activa el dispositivo | `activo` | No |
| **Suspensión** | Elimina el dispositivo y resta 1 habilitado | `bloqueado_por_suspension` | **No** |
| **Reactivación** | Vuelve a habilitar el cupo y reactiva el dispositivo | `activo` | No |
| **Baja definitiva** | Elimina el dispositivo y resta 1 habilitado | `disponible` | **Sí** |

## La regla permanente

> La **única vía** para que un Dispositivo bloqueado por suspensión quede disponible es la
> transición explícita de *suspendido* → *baja definitiva*.

No es un pendiente de roadmap: es una regla de negocio permanente. La razón es concreterísima — si
un Dispositivo bloqueado se pudiera reasignar, las credenciales de esa Cuenta terminarían en manos de
otro Cliente Final mientras el suspendido todavía podría volver. Ver
[[Riesgo aceptado - contraseña compartida]].

## Baja individual de un Dispositivo

Un Cliente Final con varios Dispositivos puede perder uno **sin** que se lo dé de baja como cliente:
la baja individual no afecta a sus otros Dispositivos ni a su estado general.

## Orden de las operaciones (y por qué)

- **Altas:** primero se reserva localmente, después se llama al Proveedor, y al final se confirma. Si
  el Proveedor falla, se revierte la reserva. El peor caso posible es una fila local sin dispositivo
  en SENSA: no cuesta plata y la reconciliación lo detecta.
- **Bajas y suspensiones:** primero el Proveedor, después lo local. Si el Proveedor falla, no se
  cambió nada y el usuario ve el mensaje de sistema congestionado. Al revés se correría el riesgo de
  dar de baja a alguien en el panel mientras sigue mirando TV.

Ver [[Consistencia con el Proveedor]].

## Ver también

- [[Flujo - Alta de Cliente Final]]
- [[Capacidad de una Cuenta]]
- [[Validación de ID de gestión externa]]
