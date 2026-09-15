#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$ROOT_DIR/tarkov-tactical-board-client"
SERVER_DIR="$ROOT_DIR/tarkov-tactical-board-server"
REMOTE_HOST="root@38.65.90.83"
REMOTE_PORT="42422"
SSH_KEY="$HOME/.ssh/usa_private_key"
IMAGE_OWNER="luopc1218docker"

info() { printf '\n[发布] %s\n' "$1"; }
fail() { printf '\n[错误] %s\n' "$1" >&2; exit 1; }

usage() {
  cat <<'EOF'
用法: ./release-local.sh [选项] [版本号]

选项:
  -v, --version <版本号>  覆盖版本号，不再自动递增（等价于直接传位置参数）
  -f, --force             允许覆盖已存在的 Tag：删除本地与远端同名 Tag 后重建
  -y, --yes               跳过确认提示
  -h, --help              显示本帮助

示例:
  ./release-local.sh                 # 自动递增 patch 版本
  ./release-local.sh 3.1.0           # 指定版本
  ./release-local.sh --version 3.1.0
  ./release-local.sh -f -v 3.0.1     # 覆盖并重建已存在的 v3.0.1 Tag
EOF
}

VERSION_OVERRIDE=""
FORCE=false
ASSUME_YES=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--version)
      [[ $# -ge 2 ]] || fail "选项 $1 缺少版本号参数"
      VERSION_OVERRIDE="$2"
      shift 2
      ;;
    -f|--force) FORCE=true; shift ;;
    -y|--yes) ASSUME_YES=true; shift ;;
    -h|--help) usage; exit 0 ;;
    --) shift; break ;;
    -*) fail "未知选项：$1（使用 --help 查看用法）" ;;
    *) VERSION_OVERRIDE="$1"; shift ;;
  esac
done

for command_name in git gh node npm perl ssh curl; do
  command -v "$command_name" >/dev/null 2>&1 || fail "缺少命令：$command_name"
done

cd "$ROOT_DIR"

[[ "$(git branch --show-current)" == "master" ]] || fail "请切换到 master 分支后再发布。"
[[ -z "$(git status --porcelain)" ]] || fail "工作区存在未提交改动，请先提交或处理后再发布。"
gh auth status >/dev/null 2>&1 || fail "GitHub CLI 尚未登录，请先执行 gh auth login。"
[[ -f "$SSH_KEY" ]] || fail "找不到服务器私钥：$SSH_KEY"

git fetch origin master --tags
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/master)" ]] || fail "本地 master 与 origin/master 不一致，请先同步。"

CURRENT_VERSION="$(node -p "require('$CLIENT_DIR/package.json').version")"
if [[ -n "$VERSION_OVERRIDE" ]]; then
  NEXT_VERSION="${VERSION_OVERRIDE#v}"
else
  IFS=. read -r major minor patch <<< "$CURRENT_VERSION"
  [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ && "$patch" =~ ^[0-9]+$ ]] || \
    fail "当前版本 $CURRENT_VERSION 不是标准三段版本号，请显式传入新版本，例如：./release-local.sh 2.1.0"
  NEXT_VERSION="$major.$minor.$((patch + 1))"
fi

[[ "$NEXT_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || fail "版本号格式无效：$NEXT_VERSION"
if [[ "$NEXT_VERSION" == "$CURRENT_VERSION" && "$FORCE" != true ]]; then
  fail "新版本与当前版本相同，如需重新发布请加 --force。"
fi

TAG="v$NEXT_VERSION"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  [[ "$FORCE" == true ]] || fail "Tag $TAG 已存在，如需覆盖请加 --force。"
  info "Tag $TAG 已存在，--force 将删除本地与远端同名 Tag 后重建"
  git tag -d "$TAG" >/dev/null
  git push origin ":refs/tags/$TAG" >/dev/null 2>&1 || true
fi
if [[ "$FORCE" == true ]] && gh release view "$TAG" >/dev/null 2>&1; then
  info "删除 GitHub 上已存在的 $TAG Release 后重建"
  gh release delete "$TAG" --yes
fi

printf '\n即将从 v%s 发布到 %s。\n' "$CURRENT_VERSION" "$TAG"
if [[ "$ASSUME_YES" != true ]]; then
  read -r -p "确认继续？[y/N] " answer
  [[ "$answer" == "y" || "$answer" == "Y" ]] || fail "已取消发布。"
fi

if [[ "$NEXT_VERSION" != "$CURRENT_VERSION" ]]; then
  info "同步前端、桌面端和后端版本号"
  (
    cd "$CLIENT_DIR"
    npm version "$NEXT_VERSION" --no-git-tag-version --ignore-scripts >/dev/null
  )
  perl -0pi -e 's/("version"\s*:\s*")[^"]+("\s*,)/${1}'"$NEXT_VERSION"'${2}/' "$CLIENT_DIR/src-tauri/tauri.conf.json"
  perl -0pi -e 's/(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+("\s*)/${1}'"$NEXT_VERSION"'${2}/' "$CLIENT_DIR/src-tauri/Cargo.toml"
  perl -0pi -e 's/(name = "tarkov-tactical-board-tauri"\s*\nversion = ")[^"]+("\s*)/${1}'"$NEXT_VERSION"'${2}/' "$CLIENT_DIR/src-tauri/Cargo.lock"
  perl -0pi -e 's/(<artifactId>tarkov-tactical-board-server<\/artifactId>\s*<version>)[^<]+(<\/version>)/${1}'"$NEXT_VERSION"'${2}/' "$SERVER_DIR/pom.xml"

  git add \
    tarkov-tactical-board-client/package.json \
    tarkov-tactical-board-client/package-lock.json \
    tarkov-tactical-board-client/src-tauri/tauri.conf.json \
    tarkov-tactical-board-client/src-tauri/Cargo.toml \
    tarkov-tactical-board-client/src-tauri/Cargo.lock \
    tarkov-tactical-board-server/pom.xml
else
  info "版本号未变化，基于当前提交重新发布"
fi

if git diff --cached --quiet; then
  info "无版本文件改动，直接在当前提交打 Tag"
else
  git commit -m "chore(release): 发布 $TAG"
fi
git tag -a "$TAG" -m "Release $TAG"

info "推送版本提交与 Tag，触发 GitHub Actions"
# Capture the newest existing run for this tag so we can detect the new run afterwards.
PREV_RUN_ID="$(gh run list --workflow release.yml --branch "$TAG" --event push --limit 1 --json databaseId --jq '.[0].databaseId // 0')"
git push origin master
git push origin "$TAG"

info "等待 GitHub Actions 完成镜像与 Windows 客户端构建"
RUN_ID=""
for _ in {1..36}; do
  CANDIDATE_RUN_ID="$(gh run list --workflow release.yml --branch "$TAG" --event push --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
  if [[ -n "$CANDIDATE_RUN_ID" && "$CANDIDATE_RUN_ID" -gt "${PREV_RUN_ID:-0}" ]]; then
    RUN_ID="$CANDIDATE_RUN_ID"
    break
  fi
  sleep 5
done
[[ -n "$RUN_ID" ]] || fail "未找到 $TAG 对应的 GitHub Actions 任务，请到仓库 Actions 页面检查。"
gh run watch "$RUN_ID" --exit-status

RELEASE_IS_DRAFT="$(gh release view "$TAG" --json isDraft --jq '.isDraft')"
[[ "$RELEASE_IS_DRAFT" == "false" ]] || fail "$TAG 仍是 Draft，停止服务器部署。"

info "部署服务器上的后端与 Web 前端"
ssh -i "$SSH_KEY" -p "$REMOTE_PORT" "$REMOTE_HOST" bash -s -- "$TAG" "$IMAGE_OWNER" <<'REMOTE_SCRIPT'
set -euo pipefail
TAG="$1"
IMAGE_OWNER="$2"
BACKEND_DIR="/opt/lpc/tarkov-tactical-board/backend"
FRONTEND_DIR="/opt/lpc/tarkov-tactical-board/frontend"

cd "$BACKEND_DIR"
cp .env.prod ".env.prod.backup-$(date +%Y%m%d-%H%M%S)"
if grep -q '^APP_IMAGE_TAG=' .env.prod; then
  sed -i "s/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=$TAG/" .env.prod
else
  printf '\nAPP_IMAGE_TAG=%s\n' "$TAG" >> .env.prod
fi

docker compose -f docker-compose.nginx.yml --env-file .env.prod pull app
cd "$FRONTEND_DIR"
FRONTEND_IMAGE="$IMAGE_OWNER/tarkov-tactical-board-frontend:$TAG" \
  docker compose -f docker-compose.frontend.yml pull tarkov_frontend

cd "$BACKEND_DIR"
docker compose -f docker-compose.nginx.yml --env-file .env.prod up -d app
cd "$FRONTEND_DIR"
FRONTEND_IMAGE="$IMAGE_OWNER/tarkov-tactical-board-frontend:$TAG" \
  docker compose -f docker-compose.frontend.yml up -d --force-recreate tarkov_frontend

docker ps --filter name=tarkov_app --filter name=tarkov_frontend \
  --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
REMOTE_SCRIPT

info "检查线上服务"
curl --fail --silent --show-error --retry 8 --retry-delay 3 \
  https://jump.mawen.site/eftboard/api/health >/dev/null
curl --fail --silent --show-error --retry 8 --retry-delay 3 \
  https://jump.mawen.site/eftboard/ >/dev/null

printf '\n[完成] %s 已构建并部署。\n' "$TAG"
printf 'GitHub Release: https://github.com/luopc1218/tarkov-tactical-board/releases/tag/%s\n' "$TAG"
