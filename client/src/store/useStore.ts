import { create } from 'zustand';
import type { Trip, Stats } from '../types';
import { TripApi } from '../api';

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
    } finally {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    const stats = await TripApi.stats();
    set({ stats });
  },

  refresh: async () => {
    await Promise.all([get().fetchTrips(), get().fetchStats()]);
  },

  toast: (message, type = 'success') => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().dismissToast(id), 2800);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
