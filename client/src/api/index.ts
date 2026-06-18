import axios from 'axios';
import type {
  Trip,
  TripDetail,
  Activity,
  Expense,
  Note,
  Stats,
  AiRecommendResult,
  InspirationCard,
} from '../types';

const api = axios.create({ baseURL: '/api', timeout: 70000 });

// ===== Trips =====
export const TripApi = {
  list: () => api.get<Trip[]>('/trips').then((r) => r.data),
  detail: (id: string) => api.get<TripDetail>(`/trips/${id}`).then((r) => r.data),
  stats: () => api.get<Stats>('/trips/stats/overview').then((r) => r.data),
  create: (data: Partial<Trip>) => api.post<Trip>('/trips', data).then((r) => r.data),
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
  inspirations: (keyword?: string) =>
    api
      .get<{ source: string; cards: InspirationCard[] }>('/ai/inspirations', {
        params: { keyword },
      })
      .then((r) => r.data),
};
