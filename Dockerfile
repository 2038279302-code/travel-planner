FROM node:20-slim

WORKDIR /app

# 1. 安装前端依赖
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

# 2. 安装后端依赖
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

# 3. 构建前端
COPY client/ ./client/
RUN cd client && npm run build

# 4. 构建后端
COPY server/ ./server/
RUN cd server && npm run build

# 5. 设置环境变量
ENV NODE_ENV=production

# 6. 启动后端服务（Express 同时托管前端静态文件）
CMD ["node", "server/dist/index.js"]
