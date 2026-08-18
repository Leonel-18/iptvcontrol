---
tags: [negocio, glosario]
deriva-de: docs/02_Glosario_de_Actores_y_Entidades.md
---

# Glosario de actores y entidades

> Nomenclatura oficial del proyecto. Se usa igual en código, base de datos y documentación.
> **No usar la palabra "slot":** el nombre oficial es **Dispositivo**.

## Actores

```mermaid
graph LR
    PROV["Proveedor<br/>(SENSA)"] -->|"provee contenido"| OP["Operador Principal<br/>(Tecnología Activa)"]
    OP -->|"vende Cuentas"| ER["Empresa Revendedora<br/>(ISP)"]
    ER -->|"vende servicio"| CF["Cliente Final"]

    classDef externo fill:#E6EAF1,stroke:#4A5B77
    classDef propio fill:#D9ECFD,stroke:#1E88E5
    class PROV externo
    class OP,ER propio
```

| Actor | Qué es | Accede al sistema |
|---|---|---|
| **Proveedor** | Plataforma de contenido IPTV. Hoy SENSA. Reemplazable a futuro. | No (es una API) |
| **Operador Principal** | Titular del contrato con el Proveedor. Crea las Cuentas, define modalidades y precios. Tecnología Activa es el primero. | Sí, panel propio |
| **Empresa Revendedora** | ISP que compra Cuentas al Operador y las revende. Define sus propios precios al Cliente Final. | Sí, panel propio y aislado |
| **Cliente Final** | Quien consume el servicio. Lo da de alta la Empresa Revendedora. | **No**, nunca |

El hecho de que el Cliente Final **no tenga acceso** es la razón por la que los logins del sistema
se llaman [[Team Members]] y no "usuarios": si a las dos cosas se les dice "usuario", aparecen
errores de permisos.

## Entidades

```mermaid
erDiagram
    OPERADOR_PRINCIPAL ||--o{ EMPRESA_REVENDEDORA : "tiene"
    EMPRESA_REVENDEDORA ||--o{ CUENTA : "tiene"
    EMPRESA_REVENDEDORA ||--o{ CLIENTE_FINAL : "tiene"
    CUENTA ||--o{ DISPOSITIVO : "aloja hasta 3+3"
    CLIENTE_FINAL ||--o{ DISPOSITIVO : "usa"
    MODALIDAD_COMERCIAL ||--o{ EMPRESA_REVENDEDORA : "aplica a"
```

### Cuenta

Unidad de contratación entre el Operador Principal y el Proveedor, y **la unidad que se factura**.

- Un usuario, una contraseña y un PIN únicos.
- Un identificador tipo **DNI** exigido por SENSA, generado por IPTVControl (no es un DNI real).
- Un correo de contacto derivado del correo de la Empresa Revendedora.
- Capacidad: **3 dispositivos fijos + 3 móviles**. Ver [[Capacidad de una Cuenta]].
- Se crea parametrizada en **1 fijo + 1 móvil** y crece de a un dispositivo por vez.

### Dispositivo

Unidad de gestión interna de la Empresa Revendedora: un equipo físico (TV o móvil) vinculado a un
Cliente Final dentro de una Cuenta.

- **No tiene precio propio** en el sistema: cuánto le cobra la Empresa Revendedora a su Cliente
  Final se define por fuera de IPTVControl.
- Se identifica por el **ID que devuelve SENSA** al activarlo.
- Admite una **nota descriptiva** libre ("TV living"), que es dato interno: no se envía al
  Proveedor y no se expone al Operador Principal.

### Relación Cuenta – Dispositivo – Cliente Final

Una misma Cuenta puede estar compartida por hasta 6 Clientes Finales, cada uno con su Dispositivo.

> **Punto crítico:** todos ellos reciben **las mismas credenciales**, sin saberlo entre sí. Ver
> [[Riesgo aceptado - contraseña compartida]].

## Ver también

- [[Modalidades comerciales]]
- [[Ciclo de vida del Cliente Final]]
- [[Team Members]]
