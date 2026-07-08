import axios, { AxiosError } from 'axios';
import type {
  Trip,
  TripDetail,
  Activity,
  Expense,
  Note,
  Stats,
  AiRecommendResult,
  AiDayPlan,
  InspirationCard,
} from '../types';
import { getAccessCode, clearAccessCode } from '../utils/auth';

const api = axios.create({ baseURL: '/api', timeout: 70000 });

/**
 * 统一错误类型：所有通过 api 实例发出的请求，失败时都会被规整成这个结构，
 * 方便调用方在 catch 中拿到人类可读的错误信息（P0-4）。
 */
export interface ApiError {
  status: number | null;
  message: string;
  isNetworkError: boolean;
  isAuthError: boolean;
  raw: unknown;
}

/** 触发"需要重新验证访问口令"的回调，由 AuthGate 注册 */
let onAuthError: (() => void) | null = null;
export function setOnAuthError(handler: (() => void) | null) {
  onAuthError = handler;
}

// 请求拦截器：自动携带访问口令
api.interceptors.request.use((config) => {
  const code = getAccessCode();
  if (code) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)['x-access-code'] = code;
  }
  return config;
});

// 响应拦截器：统一转换错误，网络异常/超时/非 2xx 都规整为 ApiError，
// 避免各页面各自处理不一致，导致"静默失败"（P0-4）。
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: string }>) => {
    const status = error.response?.status ?? null;
    const isNetworkError = !error.response;
    const isAuthError = status === 401;

    if (isAuthError) {
      clearAccessCode();
      onAuthError?.();
    }

    const message = isNetworkError
      ? '网络连接异常，请检查网络后重试'
      : error.response?.data?.error ||
        (status && status >= 500
          ? '服务器开小差了，请稍后重试'
          : status === 404
            ? '请求的资源不存在'
            : '请求失败，请重试');

    const apiError: ApiError = { status, message, isNetworkError, isAuthError, raw: error };
    return Promise.reject(apiError);
  }
);

// ===== Trips =====
export const TripApi = {
  list: () => api.get<Trip[]>('/trips').then((r) => r.data),
  detail: (id: string) => api.get<TripDetail>(`/trips/${id}`).then((r) => r.data),
  stats: () => api.get<Stats>('/trips/stats/overview').then((r) => r.data),
  create: (data: Partial<Trip>) => api.post<Trip>('/trips', data).then((r) => r.data),
  /** AI 一键保存：批量创建旅行 + 行程项（P0-5） */
  createWithActivities: (data: {
    trip: Partial<Trip>;
    activities: Array<{
      dayDate: string;
      startTime?: string | null;
      title: string;
      category: string;
      note?: string | null;
      cost: number;
      order: number;
    }>;
  }) => api.post<Trip & { activities: Activity[] }>('/trips/with-activities', data).then((r) => r.data),
  update: (id: string, data: Partial<Trip>) =>
    api.put<Trip>(`/trips/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/trips/${id}`).then((r) => r.data),
};

// ===== Activities =====
export const ActivityApi = {
  create: (tripId: string, data: Partial<Activity>) =>
    api.post<Activity>(`/trips/${tripId}/activities`, data).then((r) => r.data),
  update: (tripId: string, id: string, data: Partial<Activity>) =>
    api.put<Activity>(`/trips/${tripId}/activities/${id}`, data).then((r) => r.data),
  remove: (tripId: string, id: string) =>
    api.delete(`/trips/${tripId}/activities/${id}`).then((r) => r.data),
  /** 拖拽排序：批量更新一组行程项的日期与顺序 */
  reorder: (tripId: string, items: { id: string; dayDate: string; order: number }[]) =>
    api
      .patch<Activity[]>(`/trips/${tripId}/activities/reorder`, { items })
      .then((r) => r.data),
};

// ===== Expenses =====
export const ExpenseApi = {
  create: (tripId: string, data: Partial<Expense>) =>
    api.post<Expense>(`/trips/${tripId}/expenses`, data).then((r) => r.data),
  update: (tripId: string, id: string, data: Partial<Expense>) =>
    api.put<Expense>(`/trips/${tripId}/expenses/${id}`, data).then((r) => r.data),
  remove: (tripId: string, id: string) =>
    api.delete(`/trips/${tripId}/expenses/${id}`).then((r) => r.data),
};

// ===== Notes =====
export const NoteApi = {
  create: (tripId: string, data: Partial<Note>) =>
    api.post<Note>(`/trips/${tripId}/notes`, data).then((r) => r.data),
  update: (tripId: string, id: string, data: Partial<Note>) =>
    api.put<Note>(`/trips/${tripId}/notes/${id}`, data).then((r) => r.data),
  remove: (tripId: string, id: string) =>
    api.delete(`/trips/${tripId}/notes/${id}`).then((r) => r.data),
};

// ===== AI & Inspiration =====
export const AiApi = {
  recommend: (data: {
    destination: string;
    days: number;
    type: string;
    preferences?: string;
    budget?: number;
  }) => api.post<AiRecommendResult>('/ai/recommend', data).then((r) => r.data),
  regenerateDay: (data: {
    destination: string;
    type: string;
    day: number;
    totalDays: number;
    instruction: string;
    otherDaysDigest?: string[];
    budget?: number;
  }) => api.post<AiDayPlan>('/ai/regenerate-day', data).then((r) => r.data),
  inspirations: (keyword?: string) =>
    api
      .get<{ source: string; cards: InspirationCard[] }>('/ai/inspirations', {
        params: { keyword },
      })
      .then((r) => r.data),
};

// ===== Auth（访问口令）=====
export const AuthApi = {
  status: () => api.get<{ authEnabled: boolean }>('/auth/status').then((r) => r.data),
  verify: (code: string) =>
    api.post<{ ok: boolean; authEnabled: boolean }>('/auth/verify', { code }).then((r) => r.data),
};
