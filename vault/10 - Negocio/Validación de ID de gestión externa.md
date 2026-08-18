---
tags: [negocio, alta]
deriva-de: docs/03_Reglas_de_Negocio.md (sección 2.4)
implementado-en: backend/src/modules/clientes/clientes.service.ts · frontend/src/features/customers/CustomerForm.tsx
---

# Validación de ID de gestión externa

El Cliente Final puede tener, opcionalmente, el **ID que usa la Empresa Revendedora en su propio
sistema de gestión** (`id_gestion_externo`). Sirve para conciliar con su CRM o su facturación.

## La regla: avisar, no decidir

Si el ID cargado ya existe en otro Cliente Final **de la misma Empresa Revendedora**, el sistema:

- **No bloquea** el alta.
- **No agrupa** automáticamente.
- **Avisa** y le da a elegir.

```mermaid
flowchart TD
    A["Se carga un ID de gestión"] --> B{"¿Existe otro cliente<br/>activo o suspendido<br/>con ese ID?"}
    B -->|"No"| C["Sigue el alta normal"]
    B -->|"Sí"| D["Advertencia con dos opciones"]
    D --> E["Agrupar:<br/>sumar el dispositivo al<br/>cliente ya registrado"]
    D --> F["Crear de todos modos:<br/>cliente nuevo e independiente,<br/>con el mismo ID"]
    E --> G["Flujo de dispositivo adicional"]
    F --> C

    classDef decision fill:#FDF5E4,stroke:#E8A93A
    class D decision
```

**Por qué se deja elegir:** las dos situaciones son legítimas. Puede ser que se esté dando de alta un
segundo dispositivo del mismo abonado (agrupar), o que la Empresa Revendedora reutilice el mismo ID de
CRM para varios abonados del mismo grupo familiar (crear igual).

## Alcance de la búsqueda

- Sólo dentro de la **misma Empresa Revendedora**. Nunca cruza con otras: lo garantiza el
  [[Aislamiento multi-tenant]] y además está filtrado explícitamente.
- Sólo contra clientes **activos o suspendidos**. No tiene sentido advertir por uno dado de baja.

## En el panel

La verificación se dispara al salir del campo (y también con un botón "Verificar"), en el paso 1 del
asistente. Si hay coincidencias, se listan con su número de cliente y su cantidad de dispositivos, y
no se puede avanzar sin elegir una de las dos opciones.

## Ver también

- [[Flujo - Alta de Cliente Final]]
- [[Flujo - Migración de Cuenta]]
