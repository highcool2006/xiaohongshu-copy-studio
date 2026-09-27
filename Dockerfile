# syntax=docker/dockerfile:1
#
# 小红书 AI 内容工作台 —— 生产镜像
#
# 多阶段构建：
#   阶段 1 装全部依赖并编译（前端 vite build + 后端 tsc）
#   阶段 2 只保留生产依赖与 dist/ 产物，开发依赖不进入最终镜像
#
# 安全约定：
#   - .env 与任何凭据**不进入镜像**（由 .dockerignore 排除，凭据一律运行时注入）
#   - 以非 root 用户运行
#   - 镜像内不含开发依赖（tsx / vite / typescript / concurrently 等）

# ---------- 阶段 1：构建 ----------
FROM node:22-alpine AS builder

WORKDIR /app

# 先只复制依赖清单：源码变动时这一层仍可命中缓存
COPY package.json package-lock.json ./
RUN npm ci

# 再复制源码与构建配置
COPY tsconfig.base.json vite.config.ts ./
COPY app ./app

# 产出：
#   dist/web     前端静态资源（index.html + assets/）
#   dist/server  Express 服务（入口 dist/server/index.js）
#   dist/shared  / dist/prompts  后端运行时依赖的编译产物
RUN npm run build

# ---------- 阶段 2：运行 ----------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# 只装生产依赖
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 只复制构建产物：Express 用 dist/web 提供前端，dist/server 提供 /api/*
COPY --from=builder /app/dist ./dist

EXPOSE 3001

# 非 root 运行（node 镜像自带 node 用户）
USER node

# 单一入口：同一进程同时提供前端静态文件与 /api/*
CMD ["node", "dist/server/index.js"]
