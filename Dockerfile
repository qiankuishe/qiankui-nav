# 前端构建阶段
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制前端代码 (从 daohang-qk/frontend 复制)
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# 后端构建阶段
FROM node:20-slim AS backend-builder

WORKDIR /app

# 安装构建依赖 (better-sqlite3 需要)
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

# 生产阶段
FROM node:20-slim

WORKDIR /app

# 安装运行时依赖
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev && rm -rf /root/.npm

# 复制构建产物
COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/frontend/dist ./public

# 创建数据目录
RUN mkdir -p /app/data

EXPOSE 3000

VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/navigation.db

CMD ["node", "dist/server.js"]
