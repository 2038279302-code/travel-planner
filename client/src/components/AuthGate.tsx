import { useEffect, useState, type ReactNode } from 'react';
import { AuthApi, setOnAuthError } from '../api';
import { getAccessCode, setAccessCode, clearAccessCode } from '../utils/auth';

type Status = 'checking' | 'unlocked' | 'locked';

/**
 * 访问口令闸门（P0-1）：
 * - 应用启动时先向后端确认是否启用了口令鉴权；未启用则直接放行（本地开发默认体验不变）。
 * - 启用了鉴权但本地没有已保存的口令，或校验失败（含请求过程中收到 401），展示输入框拦住整个应用。
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const check = async () => {
    setStatus('checking');
    try {
      const { authEnabled } = await AuthApi.status();
      if (!authEnabled) {
        setStatus('unlocked');
        return;
      }
      const saved = getAccessCode();
      if (!saved) {
        setStatus('locked');
        return;
      }
      // 已有本地保存的口令，尝试用它直接校验一次
      const result = await AuthApi.verify(saved);
      setStatus(result.ok ? 'unlocked' : 'locked');
      if (!result.ok) clearAccessCode();
    } catch {
      // 状态接口本身请求失败（例如后端还没起来），默认先放行，避免把用户卡死在空白页；
      // 后续真正的业务请求若因为鉴权失败会被响应拦截器重新拉回锁定态。
      setStatus('unlocked');
    }
  };

  useEffect(() => {
    check();
    // 注册全局 401 回调：任意接口在使用过程中收到 401，都重新锁定并要求输入
    setOnAuthError(() => setStatus('locked'));
    return () => setOnAuthError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await AuthApi.verify(code.trim());
      if (result.ok) {
        setAccessCode(code.trim());
        setStatus('unlocked');
        setCode('');
      } else {
        setError('口令不正确，请重新输入');
      }
    } catch (err: any) {
      setError(err?.message || '校验失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        加载中…
      </div>
    );
  }

  if (status === 'locked') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <form
          onSubmit={handleSubmit}
          className="card w-full max-w-sm p-6 sm:p-8 space-y-4 animate-fade-up"
        >
          <div className="text-center">
            <div className="text-4xl mb-2">🔒</div>
            <h1 className="text-lg font-bold text-gray-800">需要访问口令</h1>
            <p className="text-sm text-gray-400 mt-1">
              这段旅行数据受到保护，请输入访问口令继续
            </p>
          </div>
          <div>
            <input
              autoFocus
              type="password"
              className={`input ${error ? 'input-error' : ''}`}
              placeholder="请输入访问口令"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
            />
            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting || !code.trim()}>
            {submitting ? '验证中…' : '进入'}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
