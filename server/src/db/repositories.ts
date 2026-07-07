import { randomUUID } from 'node:crypto';
import { queryAll, queryOne, run } from './index';

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
}

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  category: string;
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

// ===================== Trip =====================
export const TripRepo = {
  all(): (Trip & { _count: { activities: number; expenses: number; notes: number } })[] {
    const trips = queryAll<Trip>('SELECT * FROM Trip ORDER BY startDate DESC');
    return trips.map((t) => ({
      ...t,
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
    // 手动级联删除（sql.js 默认外键约束可靠性有限，显式删除更稳妥）
    run('DELETE FROM Activity WHERE tripId = ?', [tripId]);
    run('DELETE FROM Expense WHERE tripId = ?', [tripId]);
    run('DELETE FROM Note WHERE tripId = ?', [tripId]);
    run('DELETE FROM Trip WHERE id = ?', [tripId]);
  },
};

function countBy(table: string, tripId: string): number {
  const r = queryOne<{ c: number }>(
    `SELECT COUNT(*) as c FROM ${table} WHERE tripId = ?`,
    [tripId]
  );
  return r?.c ?? 0;
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

  create(tripId: string, input: Omit<Activity, 'id' | 'tripId' | 'createdAt'>): Activity {
    const row: Activity = { id: id(), tripId, createdAt: now(), ...input };
    run(
      `INSERT INTO Activity (id, tripId, dayDate, startTime, endTime, title, category, location, note, cost, done, "order", createdAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        row.id, row.tripId, row.dayDate, row.startTime, row.endTime, row.title,
        row.category, row.location, row.note, row.cost, row.done ? 1 : 0,
        row.order, row.createdAt,
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
    const m = { ...existing, ...patch };
    run(
      `UPDATE Activity SET dayDate=?, startTime=?, endTime=?, title=?, category=?, location=?, note=?, cost=?, done=?, "order"=? WHERE id=?`,
      [
        m.dayDate, m.startTime, m.endTime, m.title, m.category, m.location,
        m.note, m.cost, m.done ? 1 : 0, m.order, activityId,
      ]
    );
    return m;
  },

  remove(activityId: string): void {
    run('DELETE FROM Activity WHERE id = ?', [activityId]);
  },

  /** 拖拽排序：批量更新一组行程项的日期与顺序（同天重排 / 跨天移动均走这里） */
  reorder(items: { id: string; dayDate: string; order: number }[]): Activity[] {
    const updated: Activity[] = [];
    for (const it of items) {
      const existing = this.find(it.id);
      if (!existing) continue;
      const m = { ...existing, dayDate: it.dayDate, order: it.order };
      run(`UPDATE Activity SET dayDate=?, "order"=? WHERE id=?`, [
        m.dayDate,
        m.order,
        it.id,
      ]);
      updated.push(m);
    }
    return updated;
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

  create(tripId: string, input: Omit<Expense, 'id' | 'tripId' | 'createdAt'>): Expense {
    const row: Expense = { id: id(), tripId, createdAt: now(), ...input };
    run(
      `INSERT INTO Expense (id, tripId, title, category, amount, date, createdAt) VALUES (?,?,?,?,?,?,?)`,
      [row.id, row.tripId, row.title, row.category, row.amount, row.date, row.createdAt]
    );
    return row;
  },

  find(expenseId: string): Expense | null {
    return queryOne<Expense>('SELECT * FROM Expense WHERE id = ?', [expenseId]);
  },

  update(expenseId: string, patch: Partial<Expense>): Expense | null {
    const existing = this.find(expenseId);
    if (!existing) return null;
    const m = { ...existing, ...patch };
    run('UPDATE Expense SET title=?, category=?, amount=?, date=? WHERE id=?', [
      m.title, m.category, m.amount, m.date, expenseId,
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
