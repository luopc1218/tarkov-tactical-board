#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.prod.yml"
ENV_FILE="${PROJECT_ROOT}/.env.prod"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker not found."
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Error: compose file not found: ${COMPOSE_FILE}"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Error: env file not found: ${ENV_FILE}"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Error: docker compose not found."
  exit 1
fi

echo "Pulling latest backend image from Docker Hub..."
"${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" pull app

echo "Restarting backend service..."
"${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d app

echo
echo "Backend redeploy completed."
echo "You can inspect logs with:"
echo "  ${COMPOSE_CMD[*]} -f ${COMPOSE_FILE} --env-file ${ENV_FILE} logs -f app"
