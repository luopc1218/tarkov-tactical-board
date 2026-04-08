#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.frontend.yml}"
SERVICE_NAME="${SERVICE_NAME:-tarkov_frontend}"

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

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "[ERROR] compose file not found: $COMPOSE_FILE"
  exit 1
fi

echo "[INFO] compose file: $COMPOSE_FILE"
echo "[INFO] service name: $SERVICE_NAME"

echo "[STEP 1/4] stopping frontend container..."
"${compose_cmd[@]}" -f "$COMPOSE_FILE" stop "$SERVICE_NAME" || true

echo "[STEP 2/4] pulling latest image from Docker Hub..."
"${compose_cmd[@]}" -f "$COMPOSE_FILE" pull "$SERVICE_NAME"

echo "[STEP 3/4] starting frontend container..."
"${compose_cmd[@]}" -f "$COMPOSE_FILE" up -d --force-recreate "$SERVICE_NAME"

echo "[STEP 4/4] current container status:"
"${compose_cmd[@]}" -f "$COMPOSE_FILE" ps "$SERVICE_NAME"

echo "[OK] frontend redeploy completed"
