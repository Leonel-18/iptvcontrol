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
    ELIGE -->|"Agrupar"| ADIC["Flujo de Dispositivo adicional"]
    ELIGE -->|"Crear de todos modos"| METODO

    METODO{"Método de alta"}
    METODO -->|"cuenta_exclusiva"| NUEVA["Crear Cuenta nueva<br/>todos los servicios contratados"]
    METODO -->|"dispositivo_compartido"| FIRMA["Elegir 1+1 o 2+2 y servicios<br/>básico 1 siempre incluido"]
    FIRMA --> BUSCA{"¿Hay Cuenta propia con firma<br/>idéntica, cupos suficientes<br/>y sin Ventana de curiosidad activa?"}
    BUSCA -->|"Sí"| LIBERA["Reservar cupos, subir<br/>contadores SENSA y abrir<br/>Ventana de curiosidad"]
    BUSCA -->|"No"| NUEVAC["Crear Cuenta nueva<br/>en 1/1 o 2/2"]
    NUEVA --> DNI["Generar identificador tipo DNI"]
    NUEVAC --> DNI
    DNI --> APICREA["API: crear Cuenta"]
    APICREA --> REPETIDO{"¿DNI repetido?"}
    REPETIDO -->|"Sí"| INCR["Incrementar DNI<br/>y reintentar"] --> APICREA
    REPETIDO -->|"No"| SONDEA
    LIBERA --> SONDEA["Sondear Dispositivos<br/>cada 30 s durante 10 min"]
    SONDEA --> CAND{"¿Cuántos candidatos nuevos?"}
    CAND -->|"Dentro del 1+1 o 2+2"| GUARDA["Vincular ID, MAC y tipo<br/>Dispositivo ↔ Cliente ↔ Cuenta"]
    CAND -->|"Excede cupos"| AMBIGUA["Incidencia pendiente<br/>de revisión manual"]
    CAND -->|"Hasta 3 en Cuenta completa"| GUARDA
    CAND -->|"Ninguno al vencer"| REPONE["Liberar venta y<br/>resincronizar contadores"]

    classDef auto fill:#E9F9F0,stroke:#17B26A
    classDef decision fill:#FDF5E4,stroke:#E8A93A
    class INCR,GUARDA auto
    class ELIGE,AMBIGUA,REPONE decision
```

## Los cuatro pasos del asistente

| Paso | Qué se define | Regla asociada |
|---|---|---|
| 1 · Cliente | Nombre, contacto e ID de gestión externa | [[Validación de ID de gestión externa]] |
| 2 · Método y servicios | Cuenta exclusiva o compartida; cupos 1+1/2+2, servicios y duración de la [[Ventana de curiosidad]] | [[Capacidad de una Cuenta]] |
| 3 · Dispositivo | Instrucciones para el primer login; no se pide tipo ni MAC | — |
| 4 · Confirmar | Resumen de qué va a pasar antes de tocar el Proveedor | — |

## El identificador tipo DNI

SENSA exige un número de DNI para crear una Cuenta. Como el sistema no gestiona DNIs reales:

- Arranca en `dni_inicial_sensa` (parametrizable por el Operador Principal).
- Se incrementa de a 1 en cada alta.
- Si SENSA responde "identificador repetido", el sistema **suma 1 y reintenta solo**, sin mostrar
  ese error al usuario.
- El correo de contacto se deriva del de la Empresa Revendedora: `contacto@isp.com` →
  `contacto1@isp.com`, `contacto2@isp.com`…

## Descubrimiento del Dispositivo

El equipo se autoprovisiona cuando el Cliente Final inicia sesión. SENSA informa ID, MAC y tipo;
IPTVControl detecta candidatos por polling porque la API no tiene webhooks. En una Cuenta completa
pueden vincularse hasta 3 candidatos al mismo Cliente Final. Una colisión de MAC nunca permite
reasignar automáticamente un Dispositivo existente.

## Si el Proveedor falla

El usuario ve: *"Intente nuevamente más tarde, sistema congestionado, comuníquese con el operador"*.
Y el sistema revierte la reserva local para no dejar un Cliente Final fantasma sin servicio. Ver
[[Consistencia con el Proveedor]].

## Ver también

- [[Flujo - Migración de Cuenta]]
- [[Ciclo de vida del Cliente Final]]
- [[Ventana de curiosidad]]
