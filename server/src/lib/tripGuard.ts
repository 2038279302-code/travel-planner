import type { Request, Response, NextFunction } from 'express';
import { TripRepo, type Trip } from '../db/repositories';

// 扩展 Express Request 类型，避免各路由文件里用 `as any` 读取 req.trip
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      trip?: Trip;
    }
  }
}

/**
 * 子资源（行程项/花销/记录）路由前置守卫：
 * 1. 校验 URL 中的 tripId 对应的旅行是否存在，不存在直接 404，避免产生孤儿数据（P1-4）；
 * 2. 将查到的 trip 挂载到 req.trip 上，供后续日期范围校验等逻辑复用，避免重复查询。
 */
export function requireTripExists(req: Request, res: Response, next: NextFunction) {
  const { tripId } = req.params as { tripId: string };
  const trip = TripRepo.find(tripId);
  if (!trip) {
    return res.status(404).json({ error: '所属旅行不存在或已被删除' });
  }
  req.trip = trip;
  next();
}

/**
 * 校验某个日期字符串是否落在旅行的 [startDate, endDate] 范围内（P1-1）。
 * 为避免过度限制，允许的范围在旅行首尾各放宽 1 天，兼容跨时区/凌晨出发等边界场景。
 */
export function isDateWithinTrip(
  dateStr: string,
  trip: { startDate: string; endDate: string }
): boolean {
  const date = new Date(dateStr).getTime();
  const start = new Date(trip.startDate).getTime() - 24 * 60 * 60 * 1000;
  const end = new Date(trip.endDate).getTime() + 24 * 60 * 60 * 1000;
  return date >= start && date <= end;
}
