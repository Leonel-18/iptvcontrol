---
tags: [flujo, alta]
deriva-de: docs/04_Esqueleto_Tecnico_Inicial.md (flujo 4.1)
implementado-en: backend/src/modules/clientes/clientes.service.ts · frontend/src/features/customers/CustomerForm.tsx
---

# Flujo — Alta de Cliente Final

Es el flujo más usado del sistema. En el panel se presenta como un **asistente paso a paso**, no como
un formulario único: tiene dos decisiones que cambian el resultado y en un formulario largo se toman
sin leerlas.

## Los dos métodos de alta

```mermaid
flowchart TD
    START["La Empresa Revendedora<br/>da de alta un Cliente Final"] --> IDGEST{"¿Cargó ID de<br/>gestión externa?"}

    IDGEST -->|"Sí"| DUP{"¿Ya existe otro cliente<br/>con ese ID?"}
    IDGEST -->|"No"| METODO
    DUP -->|"No"| METODO
    DUP -->|"Sí"| ELIGE["Advertencia con dos opciones"]
    ELIGE -->|"Agrupar"| ADIC["Flujo de Dispositivo adicional<br/>(ver Migración de Cuenta)"]
    ELIGE -->|"Crear de todos modos"| METODO

    METODO{"Método de alta"}
    METODO -->|"cuenta_exclusiva"| NUEVA["Crear Cuenta nueva<br/>SIN buscar espacio"]
    METODO -->|"dispositivo_compartido"| BUSCA{"¿Hay una Cuenta propia<br/>con lugar del tipo pedido?"}

    BUSCA -->|"Sí"| AMPLIA["Si hace falta: API +1 dispositivo"]
    BUSCA -->|"No"| NUEVA
    NUEVA --> DNI["Generar identificador tipo DNI"]
    DNI --> APICREA["API: crear Cuenta<br/>1 fijo + 1 móvil"]
    APICREA --> REPETIDO{"¿DNI repetido?"}
    REPETIDO -->|"Sí"| INCR["Incrementar DNI<br/>y reintentar"] --> APICREA
    REPETIDO -->|"No"| ACTIVA
    AMPLIA --> ACTIVA["API: activar el Dispositivo"]
    ACTIVA --> GUARDA["Guardar ID del Proveedor y vincular<br/>Dispositivo ↔ Cliente ↔ Cuenta"]

    classDef auto fill:#E9F9F0,stroke:#17B26A
    classDef decision fill:#FDF5E4,stroke:#E8A93A
    class INCR auto
    class ELIGE decision
```

## Los cuatro pasos del asistente

| Paso | Qué se define | Regla asociada |
|---|---|---|
| 1 · Cliente | Nombre, contacto e ID de gestión externa | [[Validación de ID de gestión externa]] |
| 2 · Método de alta | Cuenta exclusiva o dispositivo compartido | [[Capacidad de una Cuenta]] |
| 3 · Dispositivo | Categoría (fijo/móvil), MAC opcional, nota interna | — |
| 4 · Confirmar | Resumen de qué va a pasar antes de tocar el Proveedor | — |

## El identificador tipo DNI

SENSA exige un número de DNI para crear una Cuenta. Como el sistema no gestiona DNIs reales:

- Arranca en `dni_inicial_sensa` (parametrizable por el Operador Principal).
- Se incrementa de a 1 en cada alta.
- Si SENSA responde "identificador repetido", el sistema **suma 1 y reintenta solo**, sin mostrar
  ese error al usuario.
- El correo de contacto se deriva del de la Empresa Revendedora: `contacto@isp.com` →
  `contacto1@isp.com`, `contacto2@isp.com`…

## El caso de la MAC

- **Con MAC**: el dispositivo se crea explícitamente en el Proveedor y devuelve su ID en el acto.
- **Sin MAC**: el cupo queda habilitado y el equipo se auto-provisiona cuando el Cliente Final inicia
  sesión. El ID se captura después **por polling**, porque la API de SENSA no tiene webhooks.

## Si el Proveedor falla

El usuario ve: *"Intente nuevamente más tarde, sistema congestionado, comuníquese con el operador"*.
Y el sistema revierte la reserva local para no dejar un Cliente Final fantasma sin servicio. Ver
[[Consistencia con el Proveedor]].

## Ver también

- [[Flujo - Migración de Cuenta]]
- [[Ciclo de vida del Cliente Final]]
