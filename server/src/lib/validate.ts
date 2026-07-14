import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

/**
 * 通用 Zod 校验包装：校验 req.body，失败返回 400
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: '参数校验失败',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}

// ===== 各模型的校验 schema =====

// 预算上限：1000 万，避免极端大数值无防呆提交（P1-2）
const MAX_BUDGET = 10_000_000;

export const tripBaseSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(100),
  type: z.enum(['travel', 'business', 'weekend']).default('travel'),
  destination: z.string().min(1, '目的地不能为空').max(100),
  description: z.string().max(2000).optional().nullable(),
  coverColor: z.string().default('#FF6B9D'),
  coverEmoji: z.string().default('✈️'),
  startDate: z.string().datetime().or(z.string().min(1)),
  endDate: z.string().datetime().or(z.string().min(1)),
  budget: z.number().min(0, '预算不能为负').max(MAX_BUDGET, '预算数值过大').default(0),
  status: z.enum(['planning', 'ongoing', 'completed']).default('planning'),
});

/** 日期交叉校验：开始日期不能晚于结束日期（P1-1） */
function refineDateRange<T extends { startDate: string; endDate: string }>(
  schema: z.ZodType<T>
) {
  return schema.refine((d) => new Date(d.startDate) <= new Date(d.endDate), {
    message: '开始日期不能晚于结束日期',
    path: ['endDate'],
  });
}

export const tripSchema = refineDateRange(tripBaseSchema);

// 更新时允许部分字段，但若同时传了 startDate/endDate 仍需交叉校验；
// 若只传其中一个，需结合数据库已有值在路由层再次校验（见 trips.ts）。
export const tripUpdateSchema = tripBaseSchema.partial().refine(
  (d) => {
    if (d.startDate && d.endDate) {
      return new Date(d.startDate) <= new Date(d.endDate);
    }
    return true;
  },
  { message: '开始日期不能晚于结束日期', path: ['endDate'] }
);

/** AI 一键保存：旅行 + 行程项批量创建 */
export const tripWithActivitiesSchema = z.object({
  trip: tripSchema,
  activities: z
    .array(
      z.object({
        dayDate: z.string().min(1, '日期不能为空'),
        startTime: z.string().optional().nullable(),
        title: z.string().min(1, '标题不能为空').max(200),
        category: z
          .enum(['sightseeing', 'food', 'transport', 'hotel', 'meeting', 'other'])
          .default('sightseeing'),
        note: z.string().max(1000).optional().nullable(),
        cost: z.number().min(0).default(0),
        order: z.number().int().default(0),
      })
    )
    .max(200, '行程项不能超过 200 条'),
});

// 单项花费上限：100 万，与预算上限量级匹配（P1-2）
const MAX_COST = 1_000_000;

export const activitySchema = z.object({
  dayDate: z.string().min(1, '日期不能为空'),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  title: z.string().min(1, '标题不能为空').max(200),
  category: z
    .enum(['sightseeing', 'food', 'transport', 'hotel', 'meeting', 'other'])
    .default('sightseeing'),
  location: z.string().max(200).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  cost: z.number().min(0, '花费不能为负').max(MAX_COST, '花费数值过大').default(0),
  done: z.boolean().default(false),
  order: z.number().int().default(0),
});

export const activityUpdateSchema = activitySchema.partial();

/** 拖拽排序：批量更新行程项的日期与顺序 */
export const activityReorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        dayDate: z.string().min(1),
        order: z.number().int(),
      })
    )
    .min(1, '至少需要一项'),
});

export const expenseSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  category: z
    .enum(['transport', 'food', 'hotel', 'ticket', 'shopping', 'other'])
    .default('other'),
  amount: z.number().min(0, '金额不能为负').max(MAX_COST, '金额数值过大'),
  date: z.string().optional().nullable(),
});

export const expenseUpdateSchema = expenseSchema.partial();

export const noteSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  content: z.string().min(1, '内容不能为空'),
  mood: z.string().default('😊'),
  date: z.string().optional().nullable(),
  images: z.array(z.string().max(500, '图片链接过长')).max(9, '最多上传 9 张图片').default([]),
});

export const noteUpdateSchema = noteSchema.partial();

export const aiRecommendSchema = z.object({
  destination: z.string().min(1, '请填写目的地'),
  days: z.number().int().min(1).max(30).default(3),
  type: z.enum(['travel', 'business', 'weekend']).default('travel'),
  preferences: z.string().max(500).optional().nullable(),
  budget: z.number().min(0).optional().nullable(),
});

export const aiRegenerateDaySchema = z.object({
  destination: z.string().min(1, '请填写目的地'),
  type: z.enum(['travel', 'business', 'weekend']).default('travel'),
  day: z.number().int().min(1),
  totalDays: z.number().int().min(1).max(30),
  instruction: z.string().min(1, '请填写调整指令').max(200),
  otherDaysDigest: z.array(z.string()).optional(),
  budget: z.number().min(0).optional().nullable(),
});
