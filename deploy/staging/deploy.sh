#!/usr/bin/env bash
# Deploy Adam PreCare ke staging: build image bertag commit → migrasi DB → jalankan → health check.
# Bila health check gagal, otomatis rollback ke image sebelumnya.
#   Dipanggil oleh GitHub Actions (runner self-hosted di staging) atau manual: ./deploy/staging/deploy.sh
set -euo pipefail

# Runner launchd di macOS tidak memuat PATH login shell
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.docker/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STAGING="$ROOT/deploy/staging"
STATE_DIR="${PRECARE_STATE_DIR:-$HOME/.adam-precare-staging}"
cd "$STAGING"

if [[ ! -f .env ]]; then
  if [[ -f "$STATE_DIR/.env" ]]; then
    cp "$STATE_DIR/.env" .env   # checkout baru dari runner tidak membawa .env → ambil dari lokasi permanen
  else
    echo "ERROR: $STATE_DIR/.env belum ada. Buat dari deploy/staging/.env.example." >&2
    exit 1
  fi
fi
set -a; source .env; set +a

mkdir -p "$STATE_DIR"
NEW_TAG="$(git -C "$ROOT" rev-parse --short=12 HEAD)"
PREV_TAG="$(cat "$STATE_DIR/current_tag" 2>/dev/null || true)"
compose() { docker compose -f "$STAGING/docker-compose.yml" --env-file "$STAGING/.env" "$@"; }

echo "==> Build image $NEW_TAG (sebelumnya: ${PREV_TAG:-belum ada})"
IMAGE_TAG="$NEW_TAG" compose build api web

echo "==> Database & Redis"
compose up -d postgres redis
compose up -d --wait postgres redis

echo "==> Migrasi database (prisma migrate deploy)"
IMAGE_TAG="$NEW_TAG" compose run --rm --no-deps api npx prisma migrate deploy

if [[ "${RUN_SEED:-0}" == "1" ]]; then
  USERS="$(compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc 'SELECT count(*) FROM users' 2>/dev/null || echo 0)"
  if [[ "$USERS" == "0" ]]; then
    echo "==> Database kosong → seed data contoh"
    IMAGE_TAG="$NEW_TAG" compose run --rm --no-deps -e ALLOW_SEED=1 api npx ts-node --transpile-only prisma/seed.ts
  else
    echo "==> Seed dilewati (database sudah berisi $USERS pengguna)"
  fi
fi

echo "==> Menjalankan api & web"
IMAGE_TAG="$NEW_TAG" compose up -d --no-build api web

healthy() {
  for _ in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:4000/v1/health" >/dev/null 2>&1 && curl -fsS -o /dev/null "http://127.0.0.1:3100/login"; then
      return 0
    fi
    sleep 3
  done
  return 1
}

if healthy; then
  echo "$NEW_TAG" > "$STATE_DIR/current_tag"
  [[ -n "$PREV_TAG" && "$PREV_TAG" != "$NEW_TAG" ]] && echo "$PREV_TAG" > "$STATE_DIR/previous_tag"
  docker image prune -f --filter "label!=keep" >/dev/null 2>&1 || true
  echo "==> Deploy $NEW_TAG berhasil: web https://precare.adamlabs.dev  api ${PUBLIC_API_URL}/v1"
else
  echo "ERROR: health check gagal untuk $NEW_TAG" >&2
  compose logs --tail=80 api web >&2 || true
  if [[ -n "$PREV_TAG" ]]; then
    echo "==> Rollback ke $PREV_TAG" >&2
    IMAGE_TAG="$PREV_TAG" compose up -d --no-build api web
  fi
  exit 1
fi
