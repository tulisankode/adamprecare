#!/bin/sh
# Ganti init bawaan image postgis: hanya pasang extension postgis (tanpa tiger/topology)
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname template1 -c "CREATE EXTENSION IF NOT EXISTS postgis;"
