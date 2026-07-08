/**
 * 访问口令（P0-1）本地存取工具。
 * 与后端 server/src/lib/auth.ts 配套：后端通过环境变量 ACCESS_CODE 启用鉴权后，
 * 前端需要在每个请求头 x-access-code 中携带用户输入过的口令。
 */

const STORAGE_KEY = 'travel-planner-access-code';

export function getAccessCode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setAccessCode(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // localStorage 不可用（隐私模式等）时静默忽略，退化为每次刷新都要重新输入
  }
}

export function clearAccessCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
}
