#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.frontend.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker not found"
  exit 1
fi

compose_cmd=(docker compose)
if ! docker compose version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    compose_cmd=(docker-compose)
  else
    echo "[ERROR] docker compose plugin and docker-compose are both unavailable"
    exit 1
  fi
fi

echo "[INFO] building and restarting frontend container..."
"${compose_cmd[@]}" -f "$COMPOSE_FILE" up -d --build --force-recreate

echo "[INFO] frontend container status:"
"${compose_cmd[@]}" -f "$COMPOSE_FILE" ps

echo "[OK] done"
