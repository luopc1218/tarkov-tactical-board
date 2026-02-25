# Tarkov Tactical Board (Frontend)

Tarkov Tactical Board 前端项目，基于 React + TypeScript + Vite，支持：

- 地图列表展示与白板实例创建
- 基于 WebSocket 的多人实时协作（绘制、撤销、光标）
- 白板状态持久化（实例状态 GET/PUT）
- 地图背景加载、缩放/平移、画笔配置、撤销与清空
- 移动端双指缩放/平移，移动端工具抽屉
- 中英文切换
- 管理端登录、地图管理（CRUD + 文件上传）、实例管理（查看/删除）

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
已启用 `--host`，支持局域网设备访问。

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

## 管理端接口（当前版本）

- `GET /api/admin/maps`
- `POST /api/admin/maps`
- `PUT /api/admin/maps/{id}`
- `DELETE /api/admin/maps/{id}`
- `GET /api/admin/whiteboard/instances?includeExpired=true|false`
- `DELETE /api/admin/whiteboard/instances/{instanceId}`

## WebSocket 消息约定（前端已接入）

- `stroke.start`：开始绘制
- `stroke.append`：实时增量点同步（节流发送）
- `stroke.end`：结束绘制
- `stroke.add`：整笔兼容消息
- `stroke.undo`：撤销最后一笔同步
- `board.clear`：清空画布同步
- `cursor.move`：实时光标位置同步
- `cursor.leave`：光标离开画布

说明：若后端 WS 采用事件白名单，请确认以上事件已被允许并广播到同实例房间。

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

## Docker Compose 部署（前端）

### 文件说明

- `Dockerfile`：多阶段构建，产出静态文件并由 Nginx 提供服务
- `docker-compose.frontend.yml`：前端容器编排，映射 `127.0.0.1:18081 -> 80`
- `deploy/rebuild-frontend.sh`：一键打包并重启前端容器

### 一键打包并重启

```bash
chmod +x deploy/rebuild-frontend.sh
./deploy/rebuild-frontend.sh
```

### 宿主机 Nginx 对接示例（与后端同源）

说明：后端保持 `127.0.0.1:18080`，前端容器为 `127.0.0.1:18081`。

```nginx
server {
    listen 80;
    server_name your.domain.example;

    client_max_body_size 100M;

    location /api/ {
        proxy_pass http://127.0.0.1:18080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:18080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:18081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 目录结构（简化）

```text
src/
  api/          # 后端接口封装
  pages/        # 页面（首页、实例页、管理端）
  components/   # 通用组件
  i18n/         # 多语言资源
  lib/          # http 客户端等基础能力
  router/       # 路由解析
  types/        # 类型定义
```

## 注意事项

- 首页背景图 `src/assets/images/home_hero_bg.png` 体积较大，建议上线前压缩为 WebP/JPEG。
- 生产构建目前有 `chunk > 500KB` 警告，不影响运行，可后续做代码分包优化。

## 发布建议（1.0.1 覆盖示例）

```bash
git checkout release/1.0
git push origin release/1.0

# 覆盖本地标签
git tag -f -a v1.0.1 -m "release: v1.0.1"

# 覆盖远端标签（谨慎）
git push origin -f v1.0.1
```
