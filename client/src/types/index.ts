export type TripType = 'travel' | 'business' | 'weekend';
export type TripStatus = 'planning' | 'ongoing' | 'completed';
export type ActivityCategory =
  | 'sightseeing'
  | 'food'
  | 'transport'
  | 'hotel'
  | 'meeting'
  | 'other';
export type ExpenseCategory =
  | 'transport'
  | 'food'
  | 'hotel'
  | 'ticket'
  | 'shopping'
  | 'other';

export interface Trip {
  id: string;
  title: string;
  type: TripType;
  destination: string;
  description: string | null;
  coverColor: string;
  coverEmoji: string;
  startDate: string;
  endDate: string;
  budget: number;
  status: TripStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { activities: number; expenses: number; notes: number };
}

export interface Activity {
  id: string;
  tripId: string;
  dayDate: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  category: ActivityCategory;
  location: string | null;
  note: string | null;
  cost: number;
  done: boolean;
  order: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  createdAt: string;
}

export interface Note {
  id: string;
  tripId: string;
  title: string | null;
  content: string;
  mood: string;
  date: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TripDetail extends Trip {
  activities: Activity[];
  expenses: Expense[];
  notes: Note[];
}

export interface Stats {
  totalTrips: number;
  completed: number;
  ongoing: number;
  planning: number;
  destinationCount: number;
  totalSpent: number;
  totalBudget: number;
}

export interface AiDayPlan {
  day: number;
  theme: string;
  items: { time: string; title: string; category: string; note: string; cost: number }[];
}

export interface AiRecommendResult {
  destination: string;
  summary: string;
  tips: string[];
  days: AiDayPlan[];
  source: 'ai' | 'mock';
  estimatedTotalCost: number;
}

export interface InspirationCard {
  id: string;
  title: string;
  cover: string;
  coverEmoji: string;
  destination: string;
  tags: string[];
  author: string;
  likes: number;
  excerpt: string;
}
