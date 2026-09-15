#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env"
  set +a
fi

MYSQL_HOST="${LOCAL_MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${LOCAL_MYSQL_PORT:-${MYSQL_PORT:-3306}}"
MYSQL_DATABASE="${LOCAL_MYSQL_DATABASE:-${MYSQL_DATABASE:-tarkov_board}}"
MYSQL_USERNAME="${LOCAL_MYSQL_USERNAME:-${SPRING_DATASOURCE_USERNAME:-root}}"
MYSQL_PASSWORD="${LOCAL_MYSQL_PASSWORD:-${SPRING_DATASOURCE_PASSWORD:-${MYSQL_ROOT_PASSWORD:-Peichun@92755}}}"

mysql \
  -h"${MYSQL_HOST}" \
  -P"${MYSQL_PORT}" \
  -u"${MYSQL_USERNAME}" \
  -p"${MYSQL_PASSWORD}" \
  -D"${MYSQL_DATABASE}" \
  -e "SELECT COUNT(*) AS map_count FROM tarkov_map; SELECT username, created_at FROM auth_admin ORDER BY id;"
