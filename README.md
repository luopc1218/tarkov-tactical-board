# Tarkov Tactical Board (Frontend)

[中文](#中文) | [English](#english)

- Web Demo: <https://luopc1218.github.io/tarkov-tactical-board/>
- Backend Repository: <https://github.com/luopc1218/tarkov-tactical-board-server>
- Releases: <https://github.com/luopc1218/tarkov-tactical-board/releases>

## 中文

### 项目简介

这是一个用于《Escape from Tarkov》战术讨论的共享地图白板前端。你可以快速创建房间、分享实例 ID，并在同一张地图上进行多人实时协作。

### 当前发布策略

当前版本：**v1.5.7**

- Web 前端通过 Docker 镜像发布
- 桌面端正式渠道只保留 **Tauri Windows x64**
- 已完全放弃 Electron，不再构建或发布 Electron 安装包

### 下载与使用

| 渠道 | 说明 |
| --- | --- |
| Web | <https://luopc1218.github.io/tarkov-tactical-board/> |
| Windows 桌面版 | 在 GitHub Releases 下载 `Tarkov Tactical Board_*_x64-setup.exe` 或同批次 Windows 安装包 |

### API 与部署说明

- Web 生产环境静态资源基础路径默认是 `/eftboard/`
- Web 生产环境默认 API 是 `/eftboard/api`
- 本地开发默认 API 是 `/api`
- 可在应用设置中覆盖 API 地址，例如 `/api` 或 `https://your-domain/api`

### 本地开发

```bash
npm install
npm run dev
npm run tauri:dev
```

### 构建命令

```bash
# Web 构建（用于 Docker / 静态部署）
npm run build

# Tauri Windows x64 构建
npm run tauri:build
```

### 自动发布

#### 1. Docker 镜像

GitHub Actions 会自动构建并推送前端镜像到 Docker Hub：

- 推送到 `master`：发布 `edge` 和 `sha-*`
- 推送 `v*` 标签：发布版本标签和 `latest`

需要预先配置以下 GitHub Secrets：

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

默认镜像名：

```text
docker.io/<DOCKERHUB_USERNAME>/tarkov-tactical-board-frontend
```

#### 2. Windows Release

推送 `v*` 标签后，会自动：

- 运行前端 lint
- 构建 Tauri Windows x64 NSIS 安装包
- 上传到对应 GitHub Release

### 推荐发版流程

```bash
git push origin <your-branch>
git tag v1.5.7
git push origin v1.5.7
```

### Docker 部署建议

`docker-compose.frontend.yml` 默认跟踪 `edge`，适合测试环境。

生产环境更建议显式指定版本镜像，例如：

```bash
FRONTEND_IMAGE=luopc1218docker/tarkov-tactical-board-frontend:v1.5.7 docker compose -f docker-compose.frontend.yml up -d
```

### 常见问题

- **地图列表为空**：通常是 API 地址未配置或后端接口不可达。
- **连接状态未连接**：请检查后端服务、反向代理和 WebSocket 转发配置。
- **桌面版打不开资源**：当前正式桌面构建仅支持 Tauri Windows x64，请使用 Releases 中的 Tauri 安装包。
- **地图情报看不到内容**：当前实例页只保留抽屉式地图情报，打开后默认会展开内容区域。

## English

### Overview

A shared tactical map whiteboard frontend for Escape from Tarkov. Create an instance, share the instance ID, and collaborate on the same map in real time.

### Current Release Strategy

Current version: **v1.5.7**

- The web frontend is published as a Docker image
- The only supported desktop release channel is **Tauri Windows x64**
- Electron has been fully retired and is no longer built or released

### Download

| Channel | Description |
| --- | --- |
| Web | <https://luopc1218.github.io/tarkov-tactical-board/> |
| Windows desktop | Download the Windows installer from GitHub Releases |

### API and Deployment Notes

- Web production base path defaults to `/eftboard/`
- Web production API defaults to `/eftboard/api`
- Local development API defaults to `/api`
- You can override the API base URL in app settings

### Local Development

```bash
npm install
npm run dev
npm run tauri:dev
```

### Build Commands

```bash
# Web build
npm run build

# Tauri Windows x64 build
npm run tauri:build
```

### Automated Publishing

#### Docker image

GitHub Actions publishes the frontend image to Docker Hub:

- Push to `master`: publish `edge` and `sha-*`
- Push a `v*` tag: publish the version tag and `latest`

#### Windows release

Pushing a `v*` tag will:

- run frontend lint
- build the Tauri Windows x64 NSIS bundle
- upload the installer to the matching GitHub Release

### Recommended Release Flow

```bash
git push origin <your-branch>
git tag v1.5.7
git push origin v1.5.7
```
