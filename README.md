# Tarkov Tactical Board (Frontend)

[中文](#中文) | [English](#english)

Demo (GitHub Pages): https://luopc1218.github.io/tarkov-tactical-board/

## 中文

### 技术栈

- 前端：React 19、TypeScript 5、Vite 7、Tailwind CSS 4
- 桌面端：Electron 40、electron-builder 26
- 网络与状态：Axios、WebSocket
- 工具链：ESLint、Prettier
- 部署：Docker、Nginx

### 启动

#### 环境要求

- Node.js 20+
- npm 10+

#### 安装依赖

```bash
npm install
```

#### Web 开发启动

```bash
npm run dev
```

默认地址：`http://localhost:5173`

#### Electron 开发启动

```bash
npm run electron:dev
```

提示：前端首次使用时，可能需要打开设置弹窗配置 API 接口地址（例如 `/api` 或 `https://your-domain/api`）。

### 打包与部署

#### GitHub Pages 演示发布

- 推送到 `master` 后会自动构建并发布到 GitHub Pages。
- 仓库需要在 `Settings -> Pages` 中选择 `GitHub Actions` 作为 Source。

#### Web 构建

```bash
npm run build
```

#### Electron 打包

```bash
# 默认打包（按 electron-builder 配置生成）
npm run electron:pack

# 本地快速打包（输出 .app 目录）
npm run electron:pack:local

# macOS ARM64 DMG
npm run electron:pack:mac

# Windows 安装包
npm run electron:pack:win

# 同时打 macOS + Windows
npm run electron:pack:release
```

打包产物目录：`release/`

#### Docker 部署（前端）

```bash
chmod +x deploy/rebuild-frontend.sh
sudo ./deploy/rebuild-frontend.sh
```

#### 服务器手动更新并部署

```bash
cd /opt/tarkov-board/frontend
git fetch --tags origin
git checkout master
git pull --ff-only origin master
sudo ./deploy/rebuild-frontend.sh
```

## English

### Tech Stack

- Frontend: React 19, TypeScript 5, Vite 7, Tailwind CSS 4
- Desktop: Electron 40, electron-builder 26
- Networking and state: Axios, WebSocket
- Tooling: ESLint, Prettier
- Deployment: Docker, Nginx

### Getting Started

#### Requirements

- Node.js 20+
- npm 10+

#### Install dependencies

```bash
npm install
```

#### Start web development server

```bash
npm run dev
```

Default URL: `http://localhost:5173`

#### Start Electron development

```bash
npm run electron:dev
```

Note: On first launch, you may need to open the settings modal and configure the API base URL (for example, `/api` or `https://your-domain/api`).

### Build and Deploy

#### GitHub Pages Demo Deployment

- Pushing to `master` triggers automatic build and deployment to GitHub Pages.
- In repository `Settings -> Pages`, set Source to `GitHub Actions`.

#### Build web assets

```bash
npm run build
```

#### Package Electron app

```bash
# Default package (based on electron-builder config)
npm run electron:pack

# Fast local package (outputs .app directory)
npm run electron:pack:local

# macOS ARM64 DMG
npm run electron:pack:mac

# Windows installer
npm run electron:pack:win

# Build both macOS + Windows
npm run electron:pack:release
```

Build output directory: `release/`

#### Docker deployment (frontend)

```bash
chmod +x deploy/rebuild-frontend.sh
sudo ./deploy/rebuild-frontend.sh
```

#### Manual server update and deployment

```bash
cd /opt/tarkov-board/frontend
git fetch --tags origin
git checkout master
git pull --ff-only origin master
sudo ./deploy/rebuild-frontend.sh
```
