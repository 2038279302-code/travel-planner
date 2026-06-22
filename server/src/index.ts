import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';

import { initDb } from './db';
import tripsRouter from './routes/trips';
import activitiesRouter from './routes/activities';
import expensesRouter from './routes/expenses';
import notesRouter from './routes/notes';
import aiRouter from './routes/ai';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 业务路由
app.use('/api/trips', tripsRouter);
app.use('/api/trips/:tripId/activities', activitiesRouter);
app.use('/api/trips/:tripId/expenses', expensesRouter);
app.use('/api/trips/:tripId/notes', notesRouter);
app.use('/api/ai', aiRouter);

// 生产环境：托管前端构建产物
if (isProd) {
  const clientDist = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA 回退：所有非 /api 路由都返回 index.html
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }
} else {
  // 开发环境 404
  app.use((_req, res) => {
    res.status(404).json({ error: '接口不存在' });
  });
}

// 统一错误处理
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err);
  const message =
    err.message?.includes('Record to') || err.message?.includes('not found')
      ? '资源不存在'
      : '服务器内部错误';
  const status = message === '资源不存在' ? 404 : 500;
  res.status(status).json({ error: message });
});

// 先初始化数据库，再启动服务
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 旅行规划后端已启动： http://localhost:${PORT}`);
      console.log(`   健康检查： http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error('数据库初始化失败：', err);
    process.exit(1);
  });
