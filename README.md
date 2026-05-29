# Tarkov Tactical Board (Frontend)

[中文](#中文) | [English](#english)

- Web Demo: [<https://luopc1218.github.io/tarkov-tactical-board/>](https://jump.mawen.site/eftboard)
- Backend Repository: <https://github.com/luopc1218/tarkov-tactical-board-server>
- Releases: <https://github.com/luopc1218/tarkov-tactical-board/releases>

## 中文

### 项目简介

Tarkov Tactical Board 是一个面向《Escape from Tarkov》战术沟通场景的共享地图白板前端。

它的核心目标很直接：

- 快速创建地图协作房间
- 通过实例 ID 邀请队友加入
- 在同一张地图上实时同步标注、路线和战术草图
- 在桌面端和 Web 端保持一致的操作体验

### 当前版本

当前版本：**v1.5.7-1**

这一版主要聚焦前端体验细节：

- 强化了实例页“实时同步已连接 / 未连接”的可见性
- 为页面切换、按钮、卡片和抽屉补充了更轻量的过渡动效
- 修复了首页背景图在滚动时随内容离开视口的问题
- 调整了首页卡片透明度，让背景层次更自然，同时保留可读性

### 支持平台

- Web 前端
- Tauri Windows x64 桌面版

当前正式桌面发布渠道只保留 **Tauri Windows x64**，Electron 已停止维护与发布。

### 下载与使用

| 渠道 | 说明 |
| --- | --- |
| Web | [<https://luopc1218.github.io/tarkov-tactical-board/>](https://jump.mawen.site/eftboard) |
| Windows 桌面版 | 在 GitHub Releases 下载对应版本的 Windows 安装包 |

### 主要功能

- 房间创建与实例 ID 分享
- 多人实时白板同步
- 地图切换与基础绘制工具
- 地图情报侧边抽屉
- 可覆盖的 API 地址设置
- 桌面端窗口安全区与路由适配

### API 与运行配置

- Web 生产环境基础路径默认是 `/eftboard/`
- Web 生产环境 API 默认是 `/eftboard/api`
- 本地开发默认 API 是 `/api`
- 可以在应用设置中覆盖 API 地址，例如 `/api` 或 `https://your-domain/api`

### 本地开发

```bash
npm install
npm run dev
```

如需启动桌面端调试：

```bash
npm run tauri:dev
```

### 构建命令

```bash
# Web 构建（Docker / 静态部署）
npm run build

# Tauri Web 资源构建
npm run tauri:build:web

# Tauri Windows x64 安装包构建
npm run tauri:build
```

### 自动发布

#### 1. Docker 镜像

GitHub Actions 会自动构建并推送前端镜像到 Docker Hub：

- 推送到 `master`：发布 `edge` 和 `sha-*`
- 推送 `v*` 标签：发布版本标签和 `latest`

需要配置以下 GitHub Secrets：

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

默认镜像名：

```text
docker.io/<DOCKERHUB_USERNAME>/tarkov-tactical-board-frontend
```

#### 2. Windows Release

推送 `v*` 标签后，GitHub Actions 会自动：

- 安装前端依赖
- 运行 `npm run lint`
- 构建 Tauri Windows x64 NSIS 安装包
- 将 `.exe` 安装包上传到对应 GitHub Release

### 推荐发版流程

```bash
git push origin <your-branch>
git tag v1.5.7-1
git push origin v1.5.7-1
```

### Docker 部署建议

`docker-compose.frontend.yml` 默认跟踪 `edge`，适合测试环境。

生产环境建议显式指定版本镜像，例如：

```bash
FRONTEND_IMAGE=luopc1218docker/tarkov-tactical-board-frontend:v1.5.7-1 docker compose -f docker-compose.frontend.yml up -d
```

### 常见问题

- **地图列表为空**：通常是 API 地址未配置，或后端接口不可达。
- **连接状态未连接**：请检查后端服务、反向代理和 WebSocket 转发配置。
- **首页背景滚动时位置异常**：请确认当前版本包含首页固定背景修复，旧版本可能仍会受页面动画影响。
- **桌面版打不开资源**：当前正式桌面构建仅支持 Tauri Windows x64，请使用 Releases 中的 Tauri 安装包。
- **地图情报看不到内容**：当前实例页使用抽屉式地图情报面板，打开后会在侧边显示内容。

## English

### Overview

Tarkov Tactical Board is a shared tactical map whiteboard frontend for Escape from Tarkov.

It is built for a simple workflow:

- create a collaborative room quickly
- share the instance ID with teammates
- draw routes, marks, and plans on the same map in real time
- keep the desktop and web experience aligned

### Current Version

Current version: **v1.5.7-1**

This release mainly focuses on frontend usability polish:

- improved visibility for the realtime connection status on the instance page
- added lighter transitions for page switches, buttons, cards, and drawers
- fixed the homepage background so it stays pinned to the viewport while scrolling
- tuned homepage card transparency for a softer layered look without hurting readability

### Supported Platforms

- Web frontend
- Tauri Windows x64 desktop build

Electron is no longer maintained or released.

### Download

| Channel | Description |
| --- | --- |
| Web | [<https://luopc1218.github.io/tarkov-tactical-board/>](https://jump.mawen.site/eftboard) |
| Windows desktop | Download the Windows installer from GitHub Releases |

### Main Features

- room creation and instance ID sharing
- realtime collaborative whiteboard sync
- map switching and drawing controls
- map intel side drawer
- configurable API base URL
- desktop-safe routing and window chrome handling

### API and Runtime Notes

- Web production base path defaults to `/eftboard/`
- Web production API defaults to `/eftboard/api`
- Local development API defaults to `/api`
- You can override the API base URL in app settings

### Local Development

```bash
npm install
npm run dev
```

For desktop development:

```bash
npm run tauri:dev
```

### Build Commands

```bash
# Web build
npm run build

# Build web assets for Tauri
npm run tauri:build:web

# Build the Tauri Windows x64 installer
npm run tauri:build
```

### Automated Publishing

#### Docker image

GitHub Actions publishes the frontend image to Docker Hub:

- push to `master`: publish `edge` and `sha-*`
- push a `v*` tag: publish the version tag and `latest`

#### Windows release

Pushing a `v*` tag triggers a workflow that:

- installs dependencies
- runs `npm run lint`
- builds the Tauri Windows x64 NSIS installer
- uploads the generated `.exe` bundle to the matching GitHub Release

### Recommended Release Flow

```bash
git push origin <your-branch>
git tag v1.5.7-1
git push origin v1.5.7-1
```

### Docker Deployment Tip

`docker-compose.frontend.yml` tracks `edge` by default, which is convenient for testing.

For production, pin an explicit version image instead:

```bash
FRONTEND_IMAGE=luopc1218docker/tarkov-tactical-board-frontend:v1.5.7-1 docker compose -f docker-compose.frontend.yml up -d
```

### Troubleshooting

- **Map list is empty**: usually the API base URL is not configured correctly, or the backend is unreachable.
- **Connection status shows disconnected**: check backend availability, reverse proxy rules, and WebSocket forwarding.
- **Homepage background still scrolls away**: older builds may still be affected by the previous page transition behavior.
- **Desktop build cannot load assets**: the supported desktop release channel is Tauri Windows x64 only.
- **Map intel panel looks empty**: the current instance page uses a drawer-based intel panel on the side.
