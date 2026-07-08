import path from 'node:path';
import fs from 'node:fs';
import initSqlJs, { type Database } from 'sql.js';

// 数据库文件持久化路径（可通过环境变量覆盖）
const DB_PATH =
  process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'travel.db');

let db: Database;
let saveTimer: NodeJS.Timeout | null = null;
// 是否存在尚未落盘的变更（用于进程退出前判断是否需要强制 flush）
let dirty = false;
// 防抖第一次触发的时间戳：用于实现"最大延迟上限"，避免持续高频写入导致长时间不落盘
let firstPendingWriteAt: number | null = null;

/** 防抖最长等待时间：即使写入一直很密集，也保证至多这么久就会落盘一次 */
const MAX_DEBOUNCE_MS = 2000;
/** 常规防抖时间：合并短时间内的连续写入，降低磁盘 IO */
const DEBOUNCE_MS = 150;

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

/** 立即将内存数据库写入文件（先写临时文件再原子性 rename，避免写到一半进程被杀导致文件损坏） */
export function persist(): void {
  if (!db) return;
  const data = db.export();
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, Buffer.from(data));
  fs.renameSync(tmpPath, DB_PATH);
  dirty = false;
  firstPendingWriteAt = null;
}

/**
 * 防抖持久化：高频写入时合并落盘，降低 IO。
 * 在原有防抖基础上增加"最大等待上限"：如果写入持续密集导致防抖计时器不断被重置，
 * 也保证至多 MAX_DEBOUNCE_MS 后必然落盘一次，避免长时间只停留在内存中（P0-2）。
 */
export function schedulePersist(): void {
  dirty = true;
  const now = Date.now();
  if (firstPendingWriteAt === null) firstPendingWriteAt = now;

  if (saveTimer) clearTimeout(saveTimer);

  const elapsedSinceFirstPending = now - firstPendingWriteAt;
  const delay = Math.min(DEBOUNCE_MS, Math.max(0, MAX_DEBOUNCE_MS - elapsedSinceFirstPending));

  saveTimer = setTimeout(() => {
    persist();
    saveTimer = null;
  }, delay);
}

/** 进程退出前强制同步落盘，避免最后一批变更因防抖延迟而丢失（P0-2） */
function flushOnExit(signal?: string) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (dirty) {
    try {
      persist();
      console.log(`[DB] 进程退出前已强制落盘${signal ? `（信号: ${signal}）` : ''}`);
    } catch (err) {
      console.error('[DB] 退出前落盘失败：', err);
    }
  }
}

process.on('SIGINT', () => {
  flushOnExit('SIGINT');
  process.exit(0);
});
process.on('SIGTERM', () => {
  flushOnExit('SIGTERM');
  process.exit(0);
});
process.on('beforeExit', () => flushOnExit('beforeExit'));
process.on('uncaughtException', (err) => {
  console.error('[Fatal] 未捕获异常：', err);
  flushOnExit('uncaughtException');
  process.exit(1);
});

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
  try {
    stmt.bind(params as any);
    stmt.step();
  } finally {
    stmt.free();
  }
  schedulePersist();
}

/**
 * 在单个 SQLite 事务内执行一组写操作：全部成功才提交并落盘，任意一步失败则整体回滚，
 * 避免"半成品"数据（P0-2 事务保护 / P0-5 AI 批量保存的基础设施）。
 *
 * 注意：事务内部应调用 runRaw（不触发防抖落盘），待事务提交后由本函数统一 schedulePersist 一次。
 */
export function runInTransaction<T>(fn: () => T): T {
  const database = getDb();
  database.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    database.run('COMMIT;');
    schedulePersist();
    return result;
  } catch (err) {
    database.run('ROLLBACK;');
    throw err;
  }
}

/** 事务内部使用的写操作：不单独触发防抖落盘（由外层事务统一处理） */
export function runRaw(sql: string, params: unknown[] = []): void {
  const stmt = getDb().prepare(sql);
  try {
    stmt.bind(params as any);
    stmt.step();
  } finally {
    stmt.free();
  }
}
