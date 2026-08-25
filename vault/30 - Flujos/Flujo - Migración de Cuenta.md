---
tags: [flujo, dispositivo-adicional, capacidad]
deriva-de: docs/04_Esqueleto_Tecnico_Inicial.md (flujo 4.4)
implementado-en: backend/src/modules/dispositivos/dispositivos.service.ts
---

# Flujo — Dispositivo adicional sin migración imposible

Cuando un Cliente Final que ya tiene Dispositivos pide uno más, el sistema respeta el máximo global
de 3 por Cuenta. Si la Cuenta actual está completa, los Dispositivos existentes **no se migran**:
la venta adicional usa otra Cuenta compatible o crea una nueva.

```mermaid
flowchart TD
    A["Agregar un Dispositivo<br/>a un cliente existente"] --> B{"¿Es Cuenta completa<br/>con menos de 3 Dispositivos?"}
    B -->|"Sí"| C["Abrir descubrimiento<br/>en la misma Cuenta"]
    B -->|"No"| D["Tratar como venta adicional<br/>con firma de servicios"]
    D --> E{"¿Hay Cuenta compartida<br/>compatible y con menos de 3 ventas?"}
    E -->|"Sí"| F["Eliminar una reserva técnica<br/>y abrir descubrimiento"]
    E -->|"No"| G["Crear Cuenta nueva,<br/>reservas y descubrimiento"]
    C --> H["Los Dispositivos existentes<br/>permanecen donde están"]
    F --> H
    G --> H

    classDef alerta fill:#FDF5E4,stroke:#E8A93A
    class D,G alerta
```

## Regla central

> Nunca se intentan alojar cuatro Dispositivos en una Cuenta ni se trasladan los tres existentes
> para hacerlo posible.

La venta adicional puede quedar en otra Cuenta y, por lo tanto, usar las credenciales de esa nueva
Cuenta. El panel debe mostrarlo antes de confirmar.

## Venta unitaria

Una venta unitaria autoriza exactamente 1 Dispositivo. Agregar otro servicio al mismo Cliente Final
es una venta nueva: el wizard calcula su firma de servicios, busca una Cuenta compartida compatible
y libera exactamente una reserva técnica antes del descubrimiento.

## Ver también

- [[Capacidad de una Cuenta]]
- [[Flujo - Alta de Cliente Final]]
