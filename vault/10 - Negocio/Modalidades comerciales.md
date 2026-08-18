---
tags: [negocio, comercial]
deriva-de: docs/03_Reglas_de_Negocio.md (sección 1)
implementado-en: backend/src/modules/modalidades/
---

# Modalidades comerciales

Una Empresa Revendedora opera bajo **una sola modalidad a la vez**. El cambio —tanto downgrade como
upgrade— es **potestad exclusiva del Operador Principal**: depende del trato comercial pactado, no es
una elección libre de la Empresa Revendedora.

## Las dos modalidades

```mermaid
graph TB
    subgraph MENUDEO["Al menudeo"]
        M1["Se factura sólo por<br/>Cuentas efectivamente usadas"]
        M2["Precio por escala<br/>de volumen"]
    end

    subgraph OBLIGACION["Con obligación mensual (X5, X10…)"]
        O1["Compromiso mínimo mensual<br/>creciente y acumulativo"]
        O2["Se facturan todas las<br/>comprometidas, se usen o no"]
        O3["Las no usadas NO se pierden:<br/>quedan para el mes siguiente"]
    end

    classDef menudeo fill:#D9ECFD,stroke:#1E88E5
    classDef obligacion fill:#FDF5E4,stroke:#E8A93A
    class M1,M2 menudeo
    class O1,O2,O3 obligacion
```

### Cómo crece la obligación mensual

Con un plan X5 (ritmo de incremento 5):

| Mes | Cuentas facturadas | Puede tener activas |
|---|---|---|
| 1 | 5 | más de 5, sin problema |
| 2 | 10 | " |
| 3 | 15 | " |

El **ritmo de incremento lo parametriza el Operador Principal**: no está hardcodeado, porque puede
variar entre distribuidores o entre Proveedores.

## Precios

- Los define el **Operador Principal**, son parametrizables y se actualizan por IPC creando una
  vigencia nueva.
- La **Empresa Revendedora define sus propios precios** hacia el Cliente Final. IPTVControl **no
  interviene** en esa facturación, pero sí le muestra los precios vigentes que le corresponden.
- Todo cambio de precio queda en el [[Registro de auditoría]] con valor anterior y nuevo.

## Lo que el sistema NO hace

> Facturación y cobranza están **fuera del alcance**. IPTVControl no emite comprobantes ni gestiona
> pagos: produce el [[Reporte de consumo]] para que la facturación se haga a mano.

## Ver también

- [[Reporte de consumo]]
- [[Glosario de actores y entidades]]
