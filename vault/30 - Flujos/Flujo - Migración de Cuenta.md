---
tags: [flujo, migracion]
deriva-de: docs/04_Esqueleto_Tecnico_Inicial.md (flujo 4.4)
implementado-en: backend/src/modules/dispositivos/dispositivos.service.ts
---

# Flujo — Dispositivo adicional y migración de Cuenta

Cuando un Cliente Final que ya tiene Dispositivos pide uno más, puede pasar que su Cuenta actual ya
esté en el tope 3+3. En ese caso el sistema **le cambia de Cuenta**, migrando ahí sus Dispositivos
existentes.

```mermaid
flowchart TD
    A["Agregar un Dispositivo<br/>a un cliente existente"] --> B{"¿Su Cuenta actual tiene<br/>lugar del tipo pedido?"}
    B -->|"Sí"| C["Alta normal en la misma Cuenta"]
    B -->|"No (tope 3+3)"| D["Buscar una Cuenta propia con capacidad<br/>para TODOS sus Dispositivos + el nuevo"]
    D --> E{"¿Existe?"}
    E -->|"Sí"| F["Cuenta destino = esa"]
    E -->|"No"| G["Crear Cuenta nueva con<br/>capacidad suficiente"]
    F --> H
    G --> H["Migrar cada Dispositivo existente"]
    H --> I["Baja en la Cuenta vieja:<br/>eliminar en Proveedor y restar 1 habilitado"]
    I --> J["Alta en la Cuenta destino:<br/>ampliar y activar"]
    J --> K["Actualizar cuenta_id del Dispositivo<br/>+ registrar en auditoría"]
    K --> L["Alta del Dispositivo nuevo<br/>en la Cuenta destino"]

    classDef alerta fill:#FDF5E4,stroke:#E8A93A
    class D,G,H alerta
```

## La consecuencia que hay que avisar

> Migrar de Cuenta significa que **al Cliente Final le cambian las credenciales**: usuario,
> contraseña y PIN son de la Cuenta, no del cliente.

El panel lo advierte antes de confirmar y lo repite en el aviso posterior, para que quien opera sepa
que tiene que pasarle los datos nuevos.

## Tope absoluto

Si el cliente superara **3 fijos + 3 móviles** en total, no hay Cuenta posible que lo aloje: el
sistema corta con un mensaje explícito en lugar de crear Cuentas sueltas por dispositivo.

## Reasignación de un Dispositivo liberado

Distinto de la migración: un Dispositivo en estado `disponible` (liberado por una baja definitiva)
puede asignarse a un Cliente Final nuevo dentro de la misma Cuenta. Ahí aplica el
[[Riesgo aceptado - contraseña compartida]].

## Ver también

- [[Capacidad de una Cuenta]]
- [[Flujo - Alta de Cliente Final]]
