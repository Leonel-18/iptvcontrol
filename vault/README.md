# Vault de Obsidian — IPTVControl

Vault **nuevo, armado desde cero** para IPTVControl (no se reutiliza la estructura del vault de
FTTHControl), tal como pedía el pendiente de `docs/04_Esqueleto_Tecnico_Inicial.md`, sección 7.

## Cómo abrirlo

1. Obsidian → *Open folder as vault* → elegir esta carpeta (`vault/`).
2. Los diagramas Mermaid y los wikilinks (con doble corchete) funcionan sin plugins adicionales.

## Estructura

```
vault/
├── 00 - Índice.md                  → punto de entrada, mapa del vault
├── 10 - Negocio/                   → glosario, modalidades, ciclos de vida
├── 20 - Arquitectura/              → stack, multi-tenant, ProveedorAdapter
├── 30 - Flujos/                    → diagramas Mermaid de los flujos 4.1 a 4.7
├── 40 - Operación/                 → despliegue, seed, salud de la integración
└── 90 - Decisiones/                → decisiones tomadas y pendientes
```

## Relación con `docs/`

- `docs/` es la **fuente de verdad normativa**: alcance, reglas de negocio y convenciones. Es lo
  que se carga en cada sesión de opencode (`opencode.json` → `instructions`).
- `vault/` es la **capa de navegación y diagramas**: reescribe lo mismo en formato hipertexto, con
  diagramas Mermaid, para leerlo y explicarlo. Cuando haya una discrepancia, **manda `docs/`**.

Cada nota de este vault indica al principio de qué documento de `docs/` deriva, para poder volver
al original sin adivinar.
