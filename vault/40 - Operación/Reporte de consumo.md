---
tags: [operacion, reportes, comercial]
deriva-de: docs/01_Instrucciones_del_Proyecto.md · docs/03_Reglas_de_Negocio.md (secciones 1 y 13)
implementado-en: backend/src/modules/reportes/ · frontend/src/features/reports/
---

# Reporte de consumo

Existe para una sola cosa: que el Operador Principal pueda **facturar a mano**. IPTVControl no emite
comprobantes ni gestiona cobranzas — eso está explícitamente fuera del alcance del MVP.

## La pregunta que responde

> ¿Cuántas Cuentas le corresponde facturarle a cada Empresa Revendedora este mes?

| Columna | Qué significa |
|---|---|
| Cuentas activas | Cuántas tiene abiertas en el Proveedor |
| Cuentas en uso | Cuántas tienen al menos un Dispositivo ocupando lugar |
| Cuentas comprometidas | Según su modalidad, si es de obligación mensual (creciente y acumulativa) |
| **Cuentas sin usar** | Comprometidas que todavía no vendió. **No se pierden**: quedan para el mes siguiente |
| **Cuentas facturables** | Menudeo → las usadas · Obligación mensual → las comprometidas |
| Importe estimado | Facturables × precio por cuenta. Es una referencia, no una factura |

## Reporte de licencias

Complementa el anterior con el dato del lado del Proveedor: licencias **contratadas** por el Operador
Principal vs. **en uso**, por paquete de contenido. Se consulta en vivo a SENSA
(`GET /v4/licenses/`).

Si el Proveedor no responde, el reporte lo informa y sigue funcionando: no se cae por una dependencia
externa.

## Exportación a CSV

Disponible en los listados de Clientes Finales, Dispositivos, Cuentas, Empresas Revendedoras,
auditoría y en este reporte. No es una ruta aparte: es el mismo endpoint con `format=csv`.

Detalles que parecen menores y no lo son: separador `;` y BOM UTF-8, para que **Excel en español abra
el archivo bien de una**, con acentos y columnas separadas. Y se neutraliza la inyección de fórmulas
(un CSV con `=1+1` es un vector de ataque real).

## Ver también

- [[Modalidades comerciales]]
- [[Registro de auditoría]]
