# Tarkov Tactical Board Server

Backend service for the Tarkov Tactical Board project.

Frontend repository: [https://github.com/luopc1218/tarkov-tactical-board](https://github.com/luopc1218/tarkov-tactical-board)

Language: [中文](#中文) | [English](#english)

## 中文

### 技术栈

- Java 17+（`pom.xml` 指定 `java.version=17`）
- Maven 3.9+
- Spring Boot 3.4.2
- Spring Web / Validation / WebSocket
- Spring Data JPA + Hibernate
- Spring Security + JWT
- MySQL 8+
- Springdoc OpenAPI（Swagger UI）

### 启动

1. 环境准备
   - 安装 JDK 17+、Maven 3.9+
   - 在本机准备 MySQL 8+，默认连接 `127.0.0.1:3306/tarkov_board`
2. 检查配置
   - 本地开发运行 `mvn spring-boot:run` 时，会读取项目根目录 `.env`，因为已配置 `spring.config.import: optional:file:.env[.properties]`
   - 根目录 `.env` 现在默认是本地开发配置；Docker 部署请使用 `.env.prod`
   - 文件：`src/main/resources/application.yml`
   - 重点项：`spring.datasource.*`、`app.auth.*`、`app.jwt.*`
3. 启动后端
   ```bash
   mvn spring-boot:run
   ```
4. 验证
   ```bash
   curl http://127.0.0.1:8081/eftboard/api/health
   ```

### 本地 MySQL 预置数据与联调

如果你希望前端本地开发时直接连本地 MySQL 调试，推荐按下面的顺序：

1. 启动你本机的 MySQL
   ```bash
   mysql -h127.0.0.1 -P3306 -uroot -p
   ```
   说明：
   - 请先确认本机已有数据库 `tarkov_board`
   - 如果还没有，可先执行：
   ```sql
   CREATE DATABASE IF NOT EXISTS tarkov_board
     DEFAULT CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```
2. 启动后端并自动预置数据
   ```bash
   mvn spring-boot:run
   ```
   说明：
   - 后端启动时会自动创建表
   - `tarkov_map` 会从 `src/main/resources/seeds/tarkov-maps.json` 自动灌入默认地图数据
   - `auth_admin` 会自动创建默认管理员账号
   - 本地开发只使用你本机的 MySQL，不依赖 Docker
3. 验证本地数据库里已经有预置数据
   ```bash
   mysql -h127.0.0.1 -P3306 -uroot -p
   ```
   然后执行：
   ```sql
   USE tarkov_board;
   SELECT COUNT(*) AS map_count FROM tarkov_map;
   SELECT username, created_at FROM auth_admin;
   ```

默认情况下，项目根目录 `.env` 提供的是本地开发端口：

- MySQL：`127.0.0.1:3306`
- 后端：`http://127.0.0.1:8081/eftboard`

如果你使用 `docker-compose.nginx.yml` 或 `docker-compose.prod.yml`，请改用 `.env.prod`，不要复用本地开发 `.env`。

### 打包与部署

推荐流程：推送 `master` 或 `v*` tag 后，GitHub Actions 自动构建并推送 Docker Hub 镜像：
`luopc1218docker/tarkov-tactical-board-server`

1. 配置部署环境变量（示例）
   ```bash
   cp .env.prod.example .env.prod
   # 编辑 .env.prod，至少设置 MYSQL_ROOT_PASSWORD / APP_JWT_SECRET / APP_ADMIN_PASSWORD_HASH
   # 可选：APP_IMAGE_REPOSITORY / APP_IMAGE_TAG
   ```
2. 拉取并启动后端镜像
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod pull app
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d app
   ```
3. 部署后验证
   ```bash
   curl http://127.0.0.1:18080/api/health
   ```

### 生产环境 Docker 部署（推荐）

推荐使用根目录的 `docker-compose.prod.yml`，只部署后端与 MySQL：

- `app`：Spring Boot 后端
- `mysql`：MySQL 8.4，数据持久化到 Docker volume

1. 准备环境变量
   ```bash
   cp .env.prod.example .env.prod
   ```
2. 编辑 `.env.prod`，至少设置：
   - `MYSQL_HOST`
   - `MYSQL_BIND_ADDRESS`
   - `MYSQL_PORT`
   - `MYSQL_ROOT_PASSWORD`
   - `MYSQL_DATABASE`
   - `SERVER_PORT`
   - `APP_ADMIN_PASSWORD_HASH`
   - `APP_JWT_SECRET`
   - `APP_IMAGE_REPOSITORY`
   - `APP_IMAGE_TAG`
   - `APP_BIND_ADDRESS`
   - `APP_PORT`
3. 如果 Docker Hub 镜像是私有仓库，先登录：
   ```bash
   docker login
   ```
   如果镜像是公开仓库，可以跳过这一步。
4. 启动服务
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```
5. 更新服务
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod pull
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```
6. 查看日志
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f app
   ```

说明：

- `APP_IMAGE_REPOSITORY` 默认为 Docker Hub 仓库：
  ```env
  APP_IMAGE_REPOSITORY=luopc1218docker/tarkov-tactical-board-server
  ```
- `MYSQL_HOST` 在同一个 compose 内建议设置为 `mysql`
- `mysql` 会绑定到 `${MYSQL_BIND_ADDRESS}:${MYSQL_PORT}`，便于你按指定端口从宿主机连接
- 首次启动时，应用会自动创建基础表并初始化默认数据。
- `app` 会绑定到 `${APP_BIND_ADDRESS}:${APP_PORT}`，便于宿主机上的 Nginx 或其他反向代理接入。

### 宿主机 Nginx 反代部署

如果你已经在服务器上自行维护 `nginx`，更简单的方式是：

- 宿主机 `nginx` 继续监听 `80/443`
- Docker 只运行 `app + mysql`
- `app` 仅绑定到宿主机本地高位端口，例如 `127.0.0.1:18080`

使用文件：`docker-compose.nginx.yml`

1. 准备环境变量
   ```bash
   cp .env.prod.example .env.prod
   ```
2. 编辑 `.env.prod`，至少设置：
   - `MYSQL_HOST`
   - `MYSQL_ROOT_PASSWORD`
   - `MYSQL_DATABASE`
   - `SERVER_PORT`
   - `APP_ADMIN_PASSWORD_HASH`
   - `APP_JWT_SECRET`
   - `APP_IMAGE_REPOSITORY`
   - `APP_IMAGE_TAG`
   - `APP_BIND_ADDRESS`
   - `APP_PORT`
3. 启动后端和数据库
   ```bash
   docker compose -f docker-compose.nginx.yml --env-file .env.prod up -d
   ```
4. 验证后端
   ```bash
   curl http://127.0.0.1:18080/api/health
   ```
5. 更新服务
   ```bash
   docker compose -f docker-compose.nginx.yml --env-file .env.prod pull
   docker compose -f docker-compose.nginx.yml --env-file .env.prod up -d
   ```

Nginx 示例：

```nginx
server {
    listen 80;
    server_name your-domain.example.com;

    location /api/ {
        proxy_pass http://127.0.0.1:18080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ws/ {
        proxy_pass http://127.0.0.1:18080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Jar 方式（手工部署）仍可使用：

1. 打包
   ```bash
   mvn clean package -DskipTests
   ```
2. 运行 Jar
   ```bash
   java -jar target/tarkov-tactical-board-server-2.0.1.jar
   ```

## English

### Tech Stack

- Java 17+ (`java.version=17` in `pom.xml`)
- Maven 3.9+
- Spring Boot 3.4.2
- Spring Web / Validation / WebSocket
- Spring Data JPA + Hibernate
- Spring Security + JWT
- MySQL 8+
- Springdoc OpenAPI (Swagger UI)

### Run Locally

1. Prerequisites
   - Install JDK 17+ and Maven 3.9+
   - Prepare a local MySQL 8+ instance on `127.0.0.1:3306`
2. Check configuration
   - File: `src/main/resources/application.yml`
   - Local runs load the root `.env`; Docker deploys should use `.env.prod`
   - Key fields: `spring.datasource.*`, `app.auth.*`, `app.jwt.*`
3. Start backend
   ```bash
   mvn spring-boot:run
   ```
4. Verify
   ```bash
   curl http://127.0.0.1:8081/eftboard/api/health
   ```

### Build and Deploy

Recommended flow: after pushing `master` or a `v*` tag, GitHub Actions builds and publishes image to Docker Hub:
`luopc1218docker/tarkov-tactical-board-server`

1. Prepare deploy env vars (example)
   ```bash
   cp .env.prod.example .env.prod
   # edit .env.prod, at least set MYSQL_*/APP_JWT_SECRET/APP_ADMIN_PASSWORD_HASH
   # optional: APP_IMAGE_REPOSITORY / APP_IMAGE_TAG
   ```
2. Pull and start backend image
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod pull app
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d app
   ```
3. Post-deploy check
   ```bash
   curl http://127.0.0.1:18080/api/health
   ```

Jar flow (manual deployment) is still available:

1. Build package
   ```bash
   mvn clean package -DskipTests
   ```
2. Run Jar
   ```bash
   java -jar target/tarkov-tactical-board-server-2.0.1.jar
   ```
