import type { Request, Response, NextFunction } from 'express';

/**
 * 最简访问口令鉴权（P0-1）。
 *
 * 背景：项目当前没有完整的用户账户体系（见 ROADMAP v2.0），但后端 API 完全开放，
 * 一旦部署到公网任何人都能读写全部数据。这里先加一道最简单的"全局口令"防线：
 * - 服务端通过环境变量 ACCESS_CODE 配置一个口令；
 * - 前端在请求头 x-access-code 中携带该口令；
 * - 未配置 ACCESS_CODE 时（本地开发默认情况）不启用鉴权，避免影响开发体验。
 *
 * 这不是完整的账户/权限体系，只是"阻止未授权访问"的最低成本方案，
 * 中长期仍需按 ROADMAP F-ACC-01/02 做正式的注册登录。
 */

const ACCESS_CODE = process.env.ACCESS_CODE || '';

/** 是否已启用口令鉴权 */
export const authEnabled = ACCESS_CODE.length > 0;

function getProvidedCode(req: Request): string {
  const header = req.header('x-access-code');
  if (header) return header;
  // 兼容通过 query 传递（例如直接在浏览器地址栏访问某些链接的场景），非首选方式
  if (typeof req.query.accessCode === 'string') return req.query.accessCode;
  return '';
}

/** Express 中间件：校验访问口令 */
export function requireAccessCode(req: Request, res: Response, next: NextFunction) {
  if (!authEnabled) return next();

  const provided = getProvidedCode(req);
  if (provided && provided === ACCESS_CODE) return next();

  res.status(401).json({ error: '访问口令错误或未提供，请先完成访问验证' });
}

/** 提供给前端的口令校验接口逻辑 */
export function verifyAccessCode(req: Request, res: Response) {
  if (!authEnabled) {
    return res.json({ ok: true, authEnabled: false });
  }
  const provided = (req.body?.code as string) || '';
  if (provided === ACCESS_CODE) {
    return res.json({ ok: true, authEnabled: true });
  }
  res.status(401).json({ ok: false, authEnabled: true, error: '访问口令不正确' });
}
