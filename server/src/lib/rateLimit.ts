import type { Request, Response, NextFunction } from 'express';

/**
 * 极简内存级限流中间件（P1-5）：基于客户端 IP + 固定时间窗口计数，
 * 用于防止 AI 生成接口被无限调用导致大模型 API 费用失控。
 *
 * 注意：仅适用于单实例部署（当前项目场景）。若未来水平扩展多实例，
 * 需要改为基于 Redis 等共享存储的限流方案。
 */
export function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
  const { windowMs, max, message = '请求过于频繁，请稍后再试' } = options;
  // key: 客户端标识（IP），value: 该窗口内的请求时间戳列表
  const hits = new Map<string, number[]>();

  // 定期清理过期记录，避免内存无限增长
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const fresh = timestamps.filter((t) => now - t < windowMs);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }, windowMs);
  cleanupTimer.unref?.(); // 不阻塞进程退出

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const timestamps = (hits.get(key) || []).filter((t) => now - t < windowMs);

    if (timestamps.length >= max) {
      return res.status(429).json({ error: message });
    }

    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}
