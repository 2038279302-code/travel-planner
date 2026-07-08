import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';

import { initDb, persist } from './db';
import tripsRouter from './routes/trips';
import activitiesRouter from './routes/activities';
import expensesRouter from './routes/expenses';
import notesRouter from './routes/notes';
import aiRouter from './routes/ai';
import { requireAccessCode, verifyAccessCode, authEnabled } from './lib/auth';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const isProd = process.env.NODE_ENV === 'production';

// 生产环境下若未限制 CORS 白名单，会在无认证的情况下进一步放大攻击面（P1-9）。
// 未显式配置 CORS_ORIGIN 时，生产环境默认不开放跨域（同源访问不受影响）。
const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors(
    corsOrigin
      ? { origin: corsOrigin.split(',').map((o) => o.trim()) }
      : isProd
        ? { origin: false }
        : {}
  )
);
app.use(express.json({ limit: '10mb' }));

// 健康检查（无需鉴权，供部署平台探活）
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 访问口令校验接口（无需鉴权，否则前端无法完成首次校验）
app.post('/api/auth/verify', express.json(), verifyAccessCode);
app.get('/api/auth/status', (_req, res) => {
  res.json({ authEnabled });
});

// 除以上接口外，其余所有 /api 路由都需要携带正确的访问口令（P0-1）
app.use('/api', requireAccessCode);

// 业务路由
app.use('/api/trips', tripsRouter);
app.use('/api/trips/:tripId/activities', activitiesRouter);
app.use('/api/trips/:tripId/expenses', expensesRouter);
app.use('/api/trips/:tripId/notes', notesRouter);
app.use('/api/ai', aiRouter);

// 生产环境：托管前端构建产物
if (isProd) {
  // __dirname 是 server/dist，public 在 server/public，所以往上一级再进 public
  const clientDist = path.resolve(__dirname, '..', 'public');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA 回退：所有非 /api 路由都返回 index.html
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    // 打印路径方便调试
    console.warn(`[WARN] 前端静态文件目录不存在: ${clientDist}`);
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
