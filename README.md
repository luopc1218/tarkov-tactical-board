# Tarkov Tactical Board (Frontend)

Tarkov Tactical Board 前端项目，基于 React + TypeScript + Vite，支持：

- 地图列表展示与白板实例创建
- 基于 WebSocket 的多人实时绘制
- 白板状态持久化（实例状态 GET/PUT）
- 地图背景加载、缩放/平移、画笔配置、撤销与清空
- 中英文切换
- 管理端登录与地图管理（CRUD + 文件上传）

## 技术栈

- React 19
- TypeScript 5
- Vite 7
- Tailwind CSS 4
- Axios
- i18next + react-i18next

## 快速开始

### 1) 安装依赖

```bash
npm install
```

### 2) 启动开发环境

```bash
npm run dev
```

默认访问：`http://localhost:5173`

### 3) 构建生产包

```bash
npm run build
```

### 4) 本地预览生产包

```bash
npm run preview
```

## 后端联调要求

默认通过 Vite 代理连接后端：

- `/api` -> `http://localhost:8080`
- `/ws` -> `http://localhost:8080`

配置位于：`vite.config.ts`

请确保后端服务可访问：

- Swagger: `http://localhost:8080/swagger-ui/index.html`
- OpenAPI: `http://localhost:8080/v3/api-docs`

## 白板核心接口（当前版本）

- `POST /api/whiteboard/instances`
  - 请求体：`{ "mapId": number }`
  - 返回：`instanceId`, `mapId`, `wsPath`, `createdAt`, `expireAt`
- `GET /api/whiteboard/instances/{instanceId}`
  - 返回实例基础信息（包含 `mapId`）
- `GET /api/whiteboard/instances/{instanceId}/state`
  - 获取白板快照状态
- `PUT /api/whiteboard/instances/{instanceId}/state`
  - 保存白板快照状态

说明：前端已改为以实例接口返回的 `mapId` 为准，不再依赖 URL 传入 `mapId`。

## 环境变量

可选环境变量：

- `VITE_API_BASE_URL`：API 基础路径（默认 `/api`）
- `VITE_WS_BASE_URL`：WebSocket 基础地址（用于非同源 WS 场景）

示例（`.env.local`）：

```bash
VITE_API_BASE_URL=/api
# VITE_WS_BASE_URL=http://localhost:8080
```

## 常用脚本

- `npm run dev`：开发模式
- `npm run build`：TypeScript 检查 + 打包
- `npm run lint`：ESLint
- `npm run format`：Prettier 格式化
- `npm run format:check`：检查格式

## 目录结构（简化）

```text
src/
  api/          # 后端接口封装
  pages/        # 页面（首页、实例页、管理页）
  components/   # 通用组件
  i18n/         # 多语言资源
  lib/          # http 客户端等基础能力
  router/       # 路由解析
  types/        # 类型定义
```

## 发布建议（1.0 示例）

```bash
git checkout release/1.0
git push -u origin release/1.0
git tag -a v1.0.0 -m "release: v1.0.0"
git push origin v1.0.0
```
