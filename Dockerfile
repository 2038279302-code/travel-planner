FROM node:20-slim

WORKDIR /app

# 1. 安装前端依赖
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

# 2. 安装后端依赖
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

# 3. 构建前端（需要 devDependencies 中的 tsc/vite 等）
COPY client/ ./client/
RUN cd client && npm install && npm run build

# 4. 构建后端（需要 devDependencies 中的 tsc 等）
COPY server/ ./server/
RUN cd server && npm install && npm run build

# 5. 清理 devDependencies 减小镜像体积
RUN cd client && npm prune --omit=dev && \
    cd /app/server && npm prune --omit=dev

# 6. 设置环境变量
ENV NODE_ENV=production

# 7. 启动后端服务（Express 同时托管前端静态文件）
CMD ["node", "server/dist/index.js"]
