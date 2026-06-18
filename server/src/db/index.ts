import path from 'node:path';
import fs from 'node:fs';
import initSqlJs, { type Database } from 'sql.js';

// 数据库文件持久化路径（可通过环境变量覆盖）
const DB_PATH =
  process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'travel.db');

let db: Database;
let saveTimer: NodeJS.Timeout | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS Trip (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'travel',
  destination TEXT NOT NULL,
  description TEXT,
  coverColor TEXT NOT NULL DEFAULT '#FF6B9D',
  coverEmoji TEXT NOT NULL DEFAULT '✈️',
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  budget REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planning',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Activity (
  id TEXT PRIMARY KEY,
  tripId TEXT NOT NULL,
  dayDate TEXT NOT NULL,
  startTime TEXT,
  endTime TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'sightseeing',
  location TEXT,
  note TEXT,
  cost REAL NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (tripId) REFERENCES Trip(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Expense (
  id TEXT PRIMARY KEY,
  tripId TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  amount REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (tripId) REFERENCES Trip(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Note (
  id TEXT PRIMARY KEY,
  tripId TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT '😊',
  date TEXT NOT NULL,
  images TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (tripId) REFERENCES Trip(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_trip ON Activity(tripId);
CREATE INDEX IF NOT EXISTS idx_expense_trip ON Expense(tripId);
CREATE INDEX IF NOT EXISTS idx_note_trip ON Note(tripId);
`;

/** 初始化数据库：加载已有文件或新建，并建表 */
export async function initDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON;');
  db.run(SCHEMA);
  persist();
  return db;
}

export function getDb(): Database {
  if (!db) throw new Error('数据库尚未初始化，请先调用 initDb()');
  return db;
}

/** 立即将内存数据库写入文件 */
export function persist(): void {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/** 防抖持久化：高频写入时合并落盘，降低 IO */
export function schedulePersist(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persist();
    saveTimer = null;
  }, 150);
}

// ===== 查询辅助：将结果转为对象数组 =====

export function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params as any);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T | null {
  const rows = queryAll<T>(sql, params);
  return rows[0] ?? null;
}

export function run(sql: string, params: unknown[] = []): void {
  const stmt = getDb().prepare(sql);
  stmt.bind(params as any);
  stmt.step();
  stmt.free();
  schedulePersist();
}
