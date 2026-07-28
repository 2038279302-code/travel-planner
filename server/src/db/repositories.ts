import { randomUUID } from 'node:crypto';
import { queryAll, queryOne, run, runRaw, runInTransaction } from './index';

const now = () => new Date().toISOString();
const id = () => randomUUID();

// ===== 类型定义 =====
export interface Trip {
  id: string;
  title: string;
  type: string;
  destination: string;
  description: string | null;
  coverColor: string;
  coverEmoji: string;
  startDate: string;
  endDate: string;
  budget: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  tripId: string;
  dayDate: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  category: string;
  location: string | null;
  note: string | null;
  cost: number;
  done: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  createdAt: string;
  updatedAt: string;
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

/**
 * 根据当前时间与旅行起止日期派生展示状态（P1-3）。
 * 规则：
 * - 若用户已手动标记为 completed（提前结束旅行），继续保持 completed，不被时间回改；
 * - 若已过了结束日期，无论原状态如何都自动展示为 completed（旅行确实已结束）；
 * - 若处于起止日期之间，展示为 ongoing；
 * - 若还未开始，展示为 planning。
 * 注意：仅作为查询时的派生字段，不回写数据库，保留用户手动设置的原始值。
 */
function deriveStatus(trip: Pick<Trip, 'status' | 'startDate' | 'endDate'>): Trip['status'] {
  if (trip.status === 'completed') return 'completed';
  const now = Date.now();
  const start = new Date(trip.startDate).getTime();
  const end = new Date(trip.endDate).getTime();
  if (now > end) return 'completed';
  if (now >= start) return 'ongoing';
  return 'planning';
}

export interface TripListQuery {
  /** 标题/目的地模糊搜索关键词（P1-8） */
  keyword?: string;
  /** 排序字段：默认按开始日期倒序（P1-8） */
  sortBy?: 'startDate' | 'createdAt' | 'budget';
  sortOrder?: 'asc' | 'desc';
  /** 分页参数：预留接口能力，本期不要求前端完整分页 UI（P1-7） */
  limit?: number;
  offset?: number;
}

const TRIP_SORT_COLUMNS: Record<NonNullable<TripListQuery['sortBy']>, string> = {
  startDate: '"startDate"',
  createdAt: '"createdAt"',
  budget: 'budget',
};

// ===================== Trip =====================
export const TripRepo = {
  async all(
    query: TripListQuery = {}
  ): Promise<(Trip & { _count: { activities: number; expenses: number; notes: number } })[]> {
    const { keyword, sortBy = 'startDate', sortOrder = 'desc', limit, offset } = query;
    const column = TRIP_SORT_COLUMNS[sortBy] ?? '"startDate"';
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const params: unknown[] = [];
    let sql = 'SELECT * FROM "Trip"';
    if (keyword && keyword.trim()) {
      sql += ' WHERE title ILIKE ? OR destination ILIKE ?';
      const like = `%${keyword.trim()}%`;
      params.push(like, like);
    }
    sql += ` ORDER BY ${column} ${dir}`;
    if (typeof limit === 'number' && limit > 0) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (typeof offset === 'number' && offset > 0) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    const trips = await queryAll<Trip>(sql, params);
    const result = [];
    for (const t of trips) {
      result.push({
        ...t,
        status: deriveStatus(t),
        _count: {
          activities: await countBy('Activity', t.id),
          expenses: await countBy('Expense', t.id),
          notes: await countBy('Note', t.id),
        },
      });
    }
    return result;
  },

  async find(tripId: string): Promise<Trip | null> {
    return queryOne<Trip>('SELECT * FROM "Trip" WHERE id = ?', [tripId]);
  },

  async findWithChildren(tripId: string) {
    const trip = await this.find(tripId);
    if (!trip) return null;
    return {
      ...trip,
      status: deriveStatus(trip),
      activities: await ActivityRepo.byTrip(tripId),
      expenses: await ExpenseRepo.byTrip(tripId),
      notes: await NoteRepo.byTrip(tripId),
    };
  },

  async create(input: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>): Promise<Trip> {
    const ts = now();
    const row: Trip = { id: id(), createdAt: ts, updatedAt: ts, ...input };
    await run(
      `INSERT INTO "Trip" (id, title, type, destination, description, "coverColor", "coverEmoji", "startDate", "endDate", budget, status, "createdAt", "updatedAt")
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        row.id, row.title, row.type, row.destination, row.description,
        row.coverColor, row.coverEmoji, row.startDate, row.endDate,
        row.budget, row.status, row.createdAt, row.updatedAt,
      ]
    );
    return row;
  },

  async update(tripId: string, patch: Partial<Trip>): Promise<Trip | null> {
    const existing = await this.find(tripId);
    if (!existing) return null;
    const merged = { ...existing, ...patch, updatedAt: now() };
    await run(
      `UPDATE "Trip" SET title=?, type=?, destination=?, description=?, "coverColor"=?, "coverEmoji"=?, "startDate"=?, "endDate"=?, budget=?, status=?, "updatedAt"=? WHERE id=?`,
      [
        merged.title, merged.type, merged.destination, merged.description,
        merged.coverColor, merged.coverEmoji, merged.startDate, merged.endDate,
        merged.budget, merged.status, merged.updatedAt, tripId,
      ]
    );
    return merged;
  },

  async remove(tripId: string): Promise<void> {
    // 手动级联删除（虽然外键已声明 ON DELETE CASCADE，这里显式删除更直观、便于排查）；
    // 包一层事务，避免删到一半失败（如中途异常）留下"半删除"的孤儿数据（P0-2）。
    await runInTransaction(async () => {
      await runRaw('DELETE FROM "Activity" WHERE "tripId" = ?', [tripId]);
      await runRaw('DELETE FROM "Expense" WHERE "tripId" = ?', [tripId]);
      await runRaw('DELETE FROM "Note" WHERE "tripId" = ?', [tripId]);
      await runRaw('DELETE FROM "Trip" WHERE id = ?', [tripId]);
    });
  },

  /** 批量创建旅行 + 行程项（AI 一键保存），事务保护：要么全部成功要么全部回滚（P0-5） */
  async createWithActivities(
    tripInput: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>,
    activitiesInput: Array<{
      dayDate: string;
      startTime: string | null;
      title: string;
      category: string;
      note: string | null;
      cost: number;
      order: number;
    }>
  ): Promise<Trip & { activities: Activity[] }> {
    return runInTransaction(async () => {
      const trip = await this.create(tripInput);
      const activities: Activity[] = [];
      for (const a of activitiesInput) {
        const row = await ActivityRepo.create(trip.id, {
          dayDate: a.dayDate,
          startTime: a.startTime,
          endTime: null,
          title: a.title,
          category: a.category,
          location: null,
          note: a.note,
          cost: a.cost,
          done: false,
          order: a.order,
        });
        activities.push(row);
      }
      return { ...trip, activities };
    });
  },
};

async function countBy(table: string, tripId: string): Promise<number> {
  const r = await queryOne<{ c: string | number }>(
    `SELECT COUNT(*) as c FROM "${table}" WHERE "tripId" = ?`,
    [tripId]
  );
  return r ? Number(r.c) : 0;
}

/**
 * 一次性聚合查询所有 Trip 的花销总和，避免逐个 Trip 查询导致的 N+1 问题（P2-3）。
 * 返回 Map<tripId, totalAmount>，未产生任何花销的 Trip 不会出现在结果中（调用方需兜底为 0）。
 */
export async function sumExpensesByTrip(): Promise<Map<string, number>> {
  const rows = await queryAll<{ tripId: string; total: string | number }>(
    'SELECT "tripId", SUM(amount) as total FROM "Expense" GROUP BY "tripId"'
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.tripId, r.total ? Number(r.total) : 0);
  return map;
}

// ===================== Activity =====================
function mapActivity(r: any): Activity {
  return { ...r, done: !!r.done, order: Number(r.order) };
}

export const ActivityRepo = {
  async byTrip(tripId: string): Promise<Activity[]> {
    const rows = await queryAll(
      'SELECT * FROM "Activity" WHERE "tripId" = ? ORDER BY "dayDate" ASC, "order" ASC, "startTime" ASC',
      [tripId]
    );
    return rows.map(mapActivity);
  },

  async create(
    tripId: string,
    input: Omit<Activity, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>
  ): Promise<Activity> {
    const ts = now();
    const row: Activity = { id: id(), tripId, createdAt: ts, updatedAt: ts, ...input };
    await run(
      `INSERT INTO "Activity" (id, "tripId", "dayDate", "startTime", "endTime", title, category, location, note, cost, done, "order", "createdAt", "updatedAt")
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        row.id, row.tripId, row.dayDate, row.startTime, row.endTime, row.title,
        row.category, row.location, row.note, row.cost, row.done,
        row.order, row.createdAt, row.updatedAt,
      ]
    );
    return row;
  },

  async find(activityId: string): Promise<Activity | null> {
    const r = await queryOne('SELECT * FROM "Activity" WHERE id = ?', [activityId]);
    return r ? mapActivity(r) : null;
  },

  async update(activityId: string, patch: Partial<Activity>): Promise<Activity | null> {
    const existing = await this.find(activityId);
    if (!existing) return null;
    // updatedAt 由服务端统一生成，不允许通过 patch 覆盖（P2-2：追踪最后修改时间）
    const m = { ...existing, ...patch, updatedAt: now() };
    await run(
      `UPDATE "Activity" SET "dayDate"=?, "startTime"=?, "endTime"=?, title=?, category=?, location=?, note=?, cost=?, done=?, "order"=?, "updatedAt"=? WHERE id=?`,
      [
        m.dayDate, m.startTime, m.endTime, m.title, m.category, m.location,
        m.note, m.cost, m.done, m.order, m.updatedAt, activityId,
      ]
    );
    return m;
  },

  async remove(activityId: string): Promise<void> {
    await run('DELETE FROM "Activity" WHERE id = ?', [activityId]);
  },

  /** 拖拽排序：批量更新一组行程项的日期与顺序（同天重排 / 跨天移动均走这里） */
  async reorder(items: { id: string; dayDate: string; order: number }[]): Promise<Activity[]> {
    // 事务保护：保证一批拖拽排序要么全部生效要么全部不生效，避免中途失败导致排序错乱（P0-2）
    return runInTransaction(async () => {
      const updated: Activity[] = [];
      for (const it of items) {
        const existing = await this.find(it.id);
        if (!existing) continue;
        const m = { ...existing, dayDate: it.dayDate, order: it.order, updatedAt: now() };
        await runRaw(`UPDATE "Activity" SET "dayDate"=?, "order"=?, "updatedAt"=? WHERE id=?`, [
          m.dayDate,
          m.order,
          m.updatedAt,
          it.id,
        ]);
        updated.push(m);
      }
      return updated;
    });
  },
};

// ===================== Expense =====================
export const ExpenseRepo = {
  async byTrip(tripId: string): Promise<Expense[]> {
    return queryAll<Expense>(
      'SELECT * FROM "Expense" WHERE "tripId" = ? ORDER BY date DESC',
      [tripId]
    );
  },

  async create(
    tripId: string,
    input: Omit<Expense, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>
  ): Promise<Expense> {
    const ts = now();
    const row: Expense = { id: id(), tripId, createdAt: ts, updatedAt: ts, ...input };
    await run(
      `INSERT INTO "Expense" (id, "tripId", title, category, amount, date, "createdAt", "updatedAt") VALUES (?,?,?,?,?,?,?,?)`,
      [row.id, row.tripId, row.title, row.category, row.amount, row.date, row.createdAt, row.updatedAt]
    );
    return row;
  },

  async find(expenseId: string): Promise<Expense | null> {
    return queryOne<Expense>('SELECT * FROM "Expense" WHERE id = ?', [expenseId]);
  },

  async update(expenseId: string, patch: Partial<Expense>): Promise<Expense | null> {
    const existing = await this.find(expenseId);
    if (!existing) return null;
    // updatedAt 由服务端统一生成，不允许通过 patch 覆盖（P2-2：追踪最后修改时间）
    const m = { ...existing, ...patch, updatedAt: now() };
    await run('UPDATE "Expense" SET title=?, category=?, amount=?, date=?, "updatedAt"=? WHERE id=?', [
      m.title, m.category, m.amount, m.date, m.updatedAt, expenseId,
    ]);
    return m;
  },

  async remove(expenseId: string): Promise<void> {
    await run('DELETE FROM "Expense" WHERE id = ?', [expenseId]);
  },
};

// ===================== Note =====================
function mapNote(r: any): Note {
  let images: string[] = [];
  try {
    images = JSON.parse(r.images);
  } catch {
    images = [];
  }
  return { ...r, images };
}

export const NoteRepo = {
  async byTrip(tripId: string): Promise<Note[]> {
    const rows = await queryAll('SELECT * FROM "Note" WHERE "tripId" = ? ORDER BY date DESC', [tripId]);
    return rows.map(mapNote);
  },

  async create(
    tripId: string,
    input: Omit<Note, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>
  ): Promise<Note> {
    const ts = now();
    const row: Note = { id: id(), tripId, createdAt: ts, updatedAt: ts, ...input };
    await run(
      `INSERT INTO "Note" (id, "tripId", title, content, mood, date, images, "createdAt", "updatedAt")
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        row.id, row.tripId, row.title, row.content, row.mood, row.date,
        JSON.stringify(row.images), row.createdAt, row.updatedAt,
      ]
    );
    return row;
  },

  async find(noteId: string): Promise<Note | null> {
    const r = await queryOne('SELECT * FROM "Note" WHERE id = ?', [noteId]);
    return r ? mapNote(r) : null;
  },

  async update(noteId: string, patch: Partial<Note>): Promise<Note | null> {
    const existing = await this.find(noteId);
    if (!existing) return null;
    const m = { ...existing, ...patch, updatedAt: now() };
    await run('UPDATE "Note" SET title=?, content=?, mood=?, date=?, images=?, "updatedAt"=? WHERE id=?', [
      m.title, m.content, m.mood, m.date, JSON.stringify(m.images), m.updatedAt, noteId,
    ]);
    return m;
  },

  async remove(noteId: string): Promise<void> {
    await run('DELETE FROM "Note" WHERE id = ?', [noteId]);
  },
};
