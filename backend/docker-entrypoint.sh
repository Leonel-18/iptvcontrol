#!/bin/sh
# =============================================================================
# Entrypoint del backend: aplica migraciones y arranca la API.
# =============================================================================
# Las migraciones corren con DATABASE_URL_MIGRATIONS (owner del schema), porque
# el usuario de runtime (APP_DB_USER) no tiene permisos de DDL — y encima está
# sujeto a Row-Level Security, que es justamente lo que queremos.
# =============================================================================
set -e

echo "[entrypoint] Aplicando migraciones de Prisma..."
DATABASE_URL="${DATABASE_URL_MIGRATIONS:-$DATABASE_URL}" npx prisma migrate deploy

echo "[entrypoint] Migraciones aplicadas. Iniciando IPTVControl backend..."
exec "$@"
