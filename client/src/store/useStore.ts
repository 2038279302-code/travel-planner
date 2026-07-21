import { create } from 'zustand';
import type { Trip, Stats } from '../types';
import { TripApi } from '../api';
import type { ApiError } from '../api';

/** 从统一错误对象中提取人类可读的提示文案 */
function errMsg(err: unknown, fallback: string): string {
  const apiErr = err as Partial<ApiError> | undefined;
  return apiErr?.message || fallback;
}

interface ToastState {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppState {
  trips: Trip[];
  stats: Stats | null;
  loading: boolean;
  toasts: ToastState[];

  fetchTrips: () => Promise<void>;
  fetchStats: () => Promise<void>;
  refresh: () => Promise<void>;

  toast: (message: string, type?: ToastState['type']) => void;
  dismissToast: (id: number) => void;
}

export const useStore = create<AppState>((set, get) => ({
  trips: [],
  stats: null,
  loading: false,
  toasts: [],

  fetchTrips: async () => {
    set({ loading: true });
    try {
      const trips = await TripApi.list();
      set({ trips });
    } catch (err) {
      // 列表加载失败时弹 toast 让用户感知，而非静默失败（P0-4）
      get().toast(errMsg(err, '加载旅行列表失败'), 'error');
    } finally {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await TripApi.stats();
      set({ stats });
    } catch (err) {
      // 统计数据非关键，仅 toast 提示，不阻塞页面（P0-4）
      get().toast(errMsg(err, '加载统计数据失败'), 'error');
    }
  },

  refresh: async () => {
    await Promise.all([get().fetchTrips(), get().fetchStats()]);
  },

  toast: (message, type = 'success') => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    // 错误提示信息通常更重要、文案也更长，适当延长展示时长，
    // 避免用户来不及看清就消失（P2-4）；成功/信息类保持原时长。
    const duration = type === 'error' ? 5000 : 2800;
    setTimeout(() => get().dismissToast(id), duration);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
