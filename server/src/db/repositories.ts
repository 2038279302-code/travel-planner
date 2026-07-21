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
  startDate: 'startDate',
  createdAt: 'createdAt',
  budget: 'budget',
};

// ===================== Trip =====================
export const TripRepo = {
  all(query: TripListQuery = {}): (Trip & { _count: { activities: number; expenses: number; notes: number } })[] {
    const { keyword, sortBy = 'startDate', sortOrder = 'desc', limit, offset } = query;
    const column = TRIP_SORT_COLUMNS[sortBy] ?? 'startDate';
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const params: unknown[] = [];
    let sql = 'SELECT * FROM Trip';
    if (keyword && keyword.trim()) {
      sql += ' WHERE title LIKE ? OR destination LIKE ?';
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

    const trips = queryAll<Trip>(sql, params);
    return trips.map((t) => ({
      ...t,
      status: deriveStatus(t),
      _count: {
        activities: countBy('Activity', t.id),
        expenses: countBy('Expense', t.id),
        notes: countBy('Note', t.id),
      },
    }));
  },

  find(tripId: string): Trip | null {
    return queryOne<Trip>('SELECT * FROM Trip WHERE id = ?', [tripId]);
  },

  findWithChildren(tripId: string) {
    const trip = this.find(tripId);
    if (!trip) return null;
    return {
      ...trip,
      status: deriveStatus(trip),
      activities: ActivityRepo.byTrip(tripId),
      expenses: ExpenseRepo.byTrip(tripId),
      notes: NoteRepo.byTrip(tripId),
    };
  },

  create(input: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>): Trip {
    const ts = now();
    const row: Trip = { id: id(), createdAt: ts, updatedAt: ts, ...input };
    run(
      `INSERT INTO Trip (id, title, type, destination, description, coverColor, coverEmoji, startDate, endDate, budget, status, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        row.id, row.title, row.type, row.destination, row.description,
        row.coverColor, row.coverEmoji, row.startDate, row.endDate,
        row.budget, row.status, row.createdAt, row.updatedAt,
      ]
    );
    return row;
  },

  update(tripId: string, patch: Partial<Trip>): Trip | null {
    const existing = this.find(tripId);
    if (!existing) return null;
    const merged = { ...existing, ...patch, updatedAt: now() };
    run(
      `UPDATE Trip SET title=?, type=?, destination=?, description=?, coverColor=?, coverEmoji=?, startDate=?, endDate=?, budget=?, status=?, updatedAt=? WHERE id=?`,
      [
        merged.title, merged.type, merged.destination, merged.description,
        merged.coverColor, merged.coverEmoji, merged.startDate, merged.endDate,
        merged.budget, merged.status, merged.updatedAt, tripId,
      ]
    );
    return merged;
  },

  remove(tripId: string): void {
    // 手动级联删除（sql.js 默认外键约束可靠性有限，显式删除更稳妥）；
    // 包一层事务，避免删到一半失败（如中途异常）留下"半删除"的孤儿数据（P0-2）。
    runInTransaction(() => {
      runRaw('DELETE FROM Activity WHERE tripId = ?', [tripId]);
      runRaw('DELETE FROM Expense WHERE tripId = ?', [tripId]);
      runRaw('DELETE FROM Note WHERE tripId = ?', [tripId]);
      runRaw('DELETE FROM Trip WHERE id = ?', [tripId]);
    });
  },

  /** 批量创建旅行 + 行程项（AI 一键保存），事务保护：要么全部成功要么全部回滚（P0-5） */
  createWithActivities(
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
  ): Trip & { activities: Activity[] } {
    return runInTransaction(() => {
      const trip = this.create(tripInput);
      const activities: Activity[] = [];
      for (const a of activitiesInput) {
        const row = ActivityRepo.create(trip.id, {
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

function countBy(table: string, tripId: string): number {
  const r = queryOne<{ c: number }>(
    `SELECT COUNT(*) as c FROM ${table} WHERE tripId = ?`,
    [tripId]
  );
  return r?.c ?? 0;
}

/**
 * 一次性聚合查询所有 Trip 的花销总和，避免逐个 Trip 查询导致的 N+1 问题（P2-3）。
 * 返回 Map<tripId, totalAmount>，未产生任何花销的 Trip 不会出现在结果中（调用方需兜底为 0）。
 */
export function sumExpensesByTrip(): Map<string, number> {
  const rows = queryAll<{ tripId: string; total: number }>(
    'SELECT tripId, SUM(amount) as total FROM Expense GROUP BY tripId'
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.tripId, r.total ?? 0);
  return map;
}

// ===================== Activity =====================
function mapActivity(r: any): Activity {
  return { ...r, done: !!r.done, order: r.order };
}

export const ActivityRepo = {
  byTrip(tripId: string): Activity[] {
    const rows = queryAll(
      'SELECT * FROM Activity WHERE tripId = ? ORDER BY dayDate ASC, "order" ASC, startTime ASC',
      [tripId]
    );
    return rows.map(mapActivity);
  },

  create(tripId: string, input: Omit<Activity, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>): Activity {
    const ts = now();
    const row: Activity = { id: id(), tripId, createdAt: ts, updatedAt: ts, ...input };
    run(
      `INSERT INTO Activity (id, tripId, dayDate, startTime, endTime, title, category, location, note, cost, done, "order", createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        row.id, row.tripId, row.dayDate, row.startTime, row.endTime, row.title,
        row.category, row.location, row.note, row.cost, row.done ? 1 : 0,
        row.order, row.createdAt, row.updatedAt,
      ]
    );
    return row;
  },

  find(activityId: string): Activity | null {
    const r = queryOne('SELECT * FROM Activity WHERE id = ?', [activityId]);
    return r ? mapActivity(r) : null;
  },

  update(activityId: string, patch: Partial<Activity>): Activity | null {
    const existing = this.find(activityId);
    if (!existing) return null;
    // updatedAt 由服务端统一生成，不允许通过 patch 覆盖（P2-2：追踪最后修改时间）
    const m = { ...existing, ...patch, updatedAt: now() };
    run(
      `UPDATE Activity SET dayDate=?, startTime=?, endTime=?, title=?, category=?, location=?, note=?, cost=?, done=?, "order"=?, updatedAt=? WHERE id=?`,
      [
        m.dayDate, m.startTime, m.endTime, m.title, m.category, m.location,
        m.note, m.cost, m.done ? 1 : 0, m.order, m.updatedAt, activityId,
      ]
    );
    return m;
  },

  remove(activityId: string): void {
    run('DELETE FROM Activity WHERE id = ?', [activityId]);
  },

  /** 拖拽排序：批量更新一组行程项的日期与顺序（同天重排 / 跨天移动均走这里） */
  reorder(items: { id: string; dayDate: string; order: number }[]): Activity[] {
    // 事务保护：保证一批拖拽排序要么全部生效要么全部不生效，避免中途失败导致排序错乱（P0-2）
    return runInTransaction(() => {
      const updated: Activity[] = [];
      for (const it of items) {
        const existing = this.find(it.id);
        if (!existing) continue;
        const m = { ...existing, dayDate: it.dayDate, order: it.order, updatedAt: now() };
        runRaw(`UPDATE Activity SET dayDate=?, "order"=?, updatedAt=? WHERE id=?`, [
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
  byTrip(tripId: string): Expense[] {
    return queryAll<Expense>(
      'SELECT * FROM Expense WHERE tripId = ? ORDER BY date DESC',
      [tripId]
    );
  },

  create(tripId: string, input: Omit<Expense, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>): Expense {
    const ts = now();
    const row: Expense = { id: id(), tripId, createdAt: ts, updatedAt: ts, ...input };
    run(
      `INSERT INTO Expense (id, tripId, title, category, amount, date, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)`,
      [row.id, row.tripId, row.title, row.category, row.amount, row.date, row.createdAt, row.updatedAt]
    );
    return row;
  },

  find(expenseId: string): Expense | null {
    return queryOne<Expense>('SELECT * FROM Expense WHERE id = ?', [expenseId]);
  },

  update(expenseId: string, patch: Partial<Expense>): Expense | null {
    const existing = this.find(expenseId);
    if (!existing) return null;
    // updatedAt 由服务端统一生成，不允许通过 patch 覆盖（P2-2：追踪最后修改时间）
    const m = { ...existing, ...patch, updatedAt: now() };
    run('UPDATE Expense SET title=?, category=?, amount=?, date=?, updatedAt=? WHERE id=?', [
      m.title, m.category, m.amount, m.date, m.updatedAt, expenseId,
    ]);
    return m;
  },

  remove(expenseId: string): void {
    run('DELETE FROM Expense WHERE id = ?', [expenseId]);
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
  byTrip(tripId: string): Note[] {
    const rows = queryAll('SELECT * FROM Note WHERE tripId = ? ORDER BY date DESC', [tripId]);
    return rows.map(mapNote);
  },

  create(
    tripId: string,
    input: Omit<Note, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>
  ): Note {
    const ts = now();
    const row: Note = { id: id(), tripId, createdAt: ts, updatedAt: ts, ...input };
    run(
      `INSERT INTO Note (id, tripId, title, content, mood, date, images, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        row.id, row.tripId, row.title, row.content, row.mood, row.date,
        JSON.stringify(row.images), row.createdAt, row.updatedAt,
      ]
    );
    return row;
  },

  find(noteId: string): Note | null {
    const r = queryOne('SELECT * FROM Note WHERE id = ?', [noteId]);
    return r ? mapNote(r) : null;
  },

  update(noteId: string, patch: Partial<Note>): Note | null {
    const existing = this.find(noteId);
    if (!existing) return null;
    const m = { ...existing, ...patch, updatedAt: now() };
    run('UPDATE Note SET title=?, content=?, mood=?, date=?, images=?, updatedAt=? WHERE id=?', [
      m.title, m.content, m.mood, m.date, JSON.stringify(m.images), m.updatedAt, noteId,
    ]);
    return m;
  },

  remove(noteId: string): void {
    run('DELETE FROM Note WHERE id = ?', [noteId]);
  },
};
