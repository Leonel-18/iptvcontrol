#!/bin/bash
# =============================================================================
# Crea el usuario de aplicación de IPTVControl.
# =============================================================================
# Por qué existe este script: Prisma corre las migraciones como owner del
# schema, pero el owner de una tabla en Postgres IGNORA las políticas de
# Row-Level Security por defecto. Si la aplicación se conectara con ese mismo
# usuario, el aislamiento multi-tenant por RLS no aplicaría nunca (sería como
# poner una puerta con llave y entrar siempre por la ventana).
#
# Por eso: migraciones con ${POSTGRES_USER} (owner) y runtime con ${APP_DB_USER}
# (usuario común, sin BYPASSRLS), que sí queda sujeto a las políticas.
# Ver docs/04_Esqueleto_Tecnico_Inicial.md, sección 2.1.
# =============================================================================
set -euo pipefail

APP_USER="${APP_DB_USER:-iptvcontrol_app}"
APP_PASS="${APP_DB_PASSWORD:?APP_DB_PASSWORD es obligatoria}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_USER}') THEN
        CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASS}' NOBYPASSRLS;
      END IF;
    END
    \$\$;

    GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${APP_USER};
    GRANT USAGE ON SCHEMA public TO ${APP_USER};

    -- Permisos sobre lo que ya exista y sobre lo que cree Prisma más adelante
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_USER};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_USER};

    ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_USER};
    ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO ${APP_USER};
EOSQL

echo "[init] Usuario de aplicación '${APP_USER}' listo (sin BYPASSRLS)."
