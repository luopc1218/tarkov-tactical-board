# Tarkov Tactical Board (Frontend)

[中文](#中文) | [English](#english)

Demo (GitHub Pages): https://luopc1218.github.io/tarkov-tactical-board/
Backend Repository: https://github.com/luopc1218/tarkov-tactical-board-server

> [!IMPORTANT]
> 首次使用前请先配置 API 地址（例如 `/api` 或 `https://your-domain/api`）。
> 应用内可通过设置按钮打开配置面板；桌面端快捷键：`Cmd/Ctrl + ,`。

## Demo 截图 / Screenshots

![Demo Screenshot 1](public/example.jpeg)
![Demo Screenshot 2](public/example2.png)

## 中文

### 项目简介

这是一个用于《Escape from Tarkov》战术讨论的共享地图白板前端。
你可以快速创建房间、分享实例 ID、多人实时标点和画路线。

### 下载与安装

#### Web 版（免安装）

- 直接打开演示站：<https://luopc1218.github.io/tarkov-tactical-board/>

#### 桌面版（Windows / macOS）

- 下载地址（Releases）：<https://github.com/luopc1218/tarkov-tactical-board/releases>
- 截至 **2026-03-04**，最新稳定版本为 **v1.5.5**。
- Windows 用户下载：`Tarkov.Tactical.Board.Setup.*.exe`
- macOS (Apple Silicon) 用户下载：`Tarkov.Tactical.Board-*-arm64.dmg`

### 快速使用

1. 打开应用后，先进入设置，填写后端 API 地址并保存。
2. 回到首页，选择地图后点击 `新建房间`。
3. 在地图实例页复制 `实例 ID`，发给队友。
4. 队友可在首页通过 `已有房间 ID？直接加入` 进入同一房间。
5. 在实例页可进行画线、标点、切换地图、聊天等实时协作操作。

### 管理端（可选）

- 入口：`/admin/login`
- 主要功能：地图管理、实例管理、管理员密码修改

### 常见问题

- 地图列表为空：通常是 API 地址未配置或后端接口不可达。
- 连接状态显示未连接：请检查后端服务、反向代理和 WebSocket 转发配置。
- API 地址示例：`/api`、`https://your-domain/api`

### 开发者（可选）

如需本地二次开发，请使用以下最小流程：

```bash
npm install
npm run dev
```

桌面端联调：

```bash
npm run electron:dev
```

更多构建/打包脚本见 `package.json`。

## English

### Overview

A shared tactical map whiteboard frontend for Escape from Tarkov.
Create an instance quickly, share the instance ID, and collaborate in real time.

### Download and Install

- Web demo: <https://luopc1218.github.io/tarkov-tactical-board/>
- Desktop downloads (Releases): <https://github.com/luopc1218/tarkov-tactical-board/releases>
- As of **March 4, 2026**, the latest stable release is **v1.5.5**.
- Windows package: `Tarkov.Tactical.Board.Setup.*.exe`
- macOS (Apple Silicon) package: `Tarkov.Tactical.Board-*-arm64.dmg`

### Quick Start

1. Open settings and configure API base URL (for example `/api` or `https://your-domain/api`).
2. Choose a map and click `Create Instance`.
3. Copy and share the instance ID with teammates.
4. Teammates can join from home by entering the instance ID.
5. Use drawing/marking/map switching/chat tools for real-time collaboration.

### Admin Portal (Optional)

- Entry: `/admin/login`
- Features: map management, instance management, admin password update

### Developer Notes (Optional)

```bash
npm install
npm run dev
```

Electron dev mode:

```bash
npm run electron:dev
```

See `package.json` for full build/package scripts.
