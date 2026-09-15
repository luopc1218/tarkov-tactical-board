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
MYSQL_PASSWORD="${LOCAL_MYSQL_PASSWORD:-${SPRING_DATASOURCE_PASSWORD:-${MYSQL_ROOT_PASSWORD:-}}}"

if [[ -z "${MYSQL_PASSWORD}" ]]; then
  echo "[错误] 未提供数据库密码：请设置 LOCAL_MYSQL_PASSWORD、SPRING_DATASOURCE_PASSWORD 或 MYSQL_ROOT_PASSWORD，或在项目根目录 .env 中配置。" >&2
  exit 1
fi

# Pass the password via environment instead of argv so it is not exposed in `ps`.
MYSQL_PWD="${MYSQL_PASSWORD}" mysql \
  -h"${MYSQL_HOST}" \
  -P"${MYSQL_PORT}" \
  -u"${MYSQL_USERNAME}" \
  -D"${MYSQL_DATABASE}" \
  -e "SELECT username, created_at FROM auth_admin ORDER BY id;"
