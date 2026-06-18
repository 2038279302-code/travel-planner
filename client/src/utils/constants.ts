import type {
  TripType,
  TripStatus,
  ActivityCategory,
  ExpenseCategory,
} from '../types';

export const TRIP_TYPE: Record<TripType, { label: string; emoji: string }> = {
  travel: { label: '旅行', emoji: '🌴' },
  business: { label: '差旅', emoji: '💼' },
  weekend: { label: '周末出行', emoji: '🎒' },
};

export const TRIP_STATUS: Record<
  TripStatus,
  { label: string; color: string; bg: string }
> = {
  planning: { label: '规划中', color: '#7C3AED', bg: '#EDE9FE' },
  ongoing: { label: '进行中', color: '#0891B2', bg: '#CFFAFE' },
  completed: { label: '已完成', color: '#16A34A', bg: '#DCFCE7' },
};

export const ACTIVITY_CATEGORY: Record<
  ActivityCategory,
  { label: string; emoji: string; color: string }
> = {
  sightseeing: { label: '景点', emoji: '📸', color: '#FF6B9D' },
  food: { label: '餐饮', emoji: '🍜', color: '#FFA07A' },
  transport: { label: '交通', emoji: '🚄', color: '#4FACFE' },
  hotel: { label: '住宿', emoji: '🏨', color: '#A18CD1' },
  meeting: { label: '会议', emoji: '📊', color: '#667EEA' },
  other: { label: '其他', emoji: '✨', color: '#43E97B' },
};

export const EXPENSE_CATEGORY: Record<
  ExpenseCategory,
  { label: string; emoji: string; color: string }
> = {
  transport: { label: '交通', emoji: '🚄', color: '#4FACFE' },
  food: { label: '餐饮', emoji: '🍜', color: '#FFA07A' },
  hotel: { label: '住宿', emoji: '🏨', color: '#A18CD1' },
  ticket: { label: '门票', emoji: '🎫', color: '#FF6B9D' },
  shopping: { label: '购物', emoji: '🛍️', color: '#FEE140' },
  other: { label: '其他', emoji: '💰', color: '#43E97B' },
};

// 创建旅行时可选的主题色 + emoji
export const COVER_COLORS = [
  '#FF6B9D',
  '#FFA07A',
  '#667EEA',
  '#764BA2',
  '#4FACFE',
  '#43E97B',
  '#FA709A',
  '#A18CD1',
];

export const COVER_EMOJIS = [
  '✈️', '🌸', '🏔️', '🏖️', '🗻', '🏝️', '🎡', '🚗',
  '⛰️', '🌃', '🍁', '💼', '🎒', '🏯', '🐼', '🌊',
];
