import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient } from 'pg';

// PostgreSQL 连接串（可用 Neon / Supabase / 本地 Postgres 等任意兼容服务）。
// Neon 等云端 Postgres 通常要求 SSL 连接，本地开发一般不需要，故此处按需开启。
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('缺少环境变量 DATABASE_URL，请在 .env 中配置 PostgreSQL 连接串');
}

const useSsl = /sslmode=require/.test(DATABASE_URL) || process.env.PGSSL === 'true';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  // 连接池中空闲连接出错时（如网络抖动）不应直接崩溃整个进程
  console.error('[DB] 连接池出现未预期错误：', err);
});

// 初始建表语句：仅包含首个版本的基线结构。后续新增字段/表一律通过下方 MIGRATIONS
// 追加迁移步骤，不再直接修改这里，避免线上已有数据库跳过历史变更（P2-1）。
const SCHEMA = `
CREATE TABLE IF NOT EXISTS "Trip" (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'travel',
  destination TEXT NOT NULL,
  description TEXT,
  "coverColor" TEXT NOT NULL DEFAULT '#FF6B9D',
  "coverEmoji" TEXT NOT NULL DEFAULT '✈️',
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  budget DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planning',
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Activity" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL,
  "dayDate" TEXT NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'sightseeing',
  location TEXT,
  note TEXT,
  cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL,
  FOREIGN KEY ("tripId") REFERENCES "Trip"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Expense" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  FOREIGN KEY ("tripId") REFERENCES "Trip"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Note" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT '😊',
  date TEXT NOT NULL,
  images TEXT NOT NULL DEFAULT '[]',
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  FOREIGN KEY ("tripId") REFERENCES "Trip"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_trip ON "Activity"("tripId");
CREATE INDEX IF NOT EXISTS idx_expense_trip ON "Expense"("tripId");
CREATE INDEX IF NOT EXISTS idx_note_trip ON "Note"("tripId");
`;

/**
 * Schema 迁移机制（P2-1）：用 `schema_migrations` 版本表记录已执行的迁移，
 * 每次启动按顺序检查并执行尚未应用的迁移，而不是裸 `CREATE TABLE IF NOT EXISTS`。
 * 新增字段/表时，在此数组末尾追加一条迁移，不要修改历史迁移内容。
 */
interface Migration {
  /** 迁移版本号，从 1 开始递增，必须唯一且严格递增 */
  version: number;
  name: string;
  up: (client: PoolClient) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'baseline_schema',
    up: async (client) => {
      await client.query(SCHEMA);
    },
  },
  {
    version: 2,
    name: 'add_updatedAt_to_activity_and_expense',
    // Activity/Expense 补充 updatedAt 字段，便于追踪最后修改时间（P2-2）。
    // 已有旧数据的 updatedAt 用 createdAt 回填，保证字段非空。
    up: async (client) => {
      await client.query(`ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "updatedAt" TEXT;`);
      await client.query(`UPDATE "Activity" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;`);
      await client.query(`ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "updatedAt" TEXT;`);
      await client.query(`UPDATE "Expense" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;`);
    },
  },
];

async function ensureMigrationsTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      "appliedAt" TEXT NOT NULL
    );
  `);
}

async function getAppliedVersions(client: PoolClient): Promise<Set<number>> {
  const result = await client.query('SELECT version FROM schema_migrations');
  return new Set(result.rows.map((r) => Number(r.version)));
}

/** 依次执行尚未应用的迁移，每条迁移在事务中执行并记录版本号 */
async function runMigrations(client: PoolClient) {
  await ensureMigrationsTable(client);
  const applied = await getAppliedVersions(client);
  const pending = MIGRATIONS.filter((m) => !applied.has(m.version)).sort(
    (a, b) => a.version - b.version
  );

  for (const migration of pending) {
    await client.query('BEGIN');
    try {
      await migration.up(client);
      await client.query(
        'INSERT INTO schema_migrations (version, name, "appliedAt") VALUES ($1, $2, $3)',
        [migration.version, migration.name, new Date().toISOString()]
      );
      await client.query('COMMIT');
      console.log(`[DB] 迁移已应用：v${migration.version} ${migration.name}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(
        `[DB] 迁移执行失败：v${migration.version} ${migration.name} — ${(err as Error).message}`
      );
    }
  }
}

let initialized = false;

/** 初始化数据库：建立连接池并执行尚未应用的迁移 */
export async function initDb(): Promise<void> {
  if (initialized) return;
  const client = await pool.connect();
  try {
    await runMigrations(client);
  } finally {
    client.release();
  }
  initialized = true;
}

// ===== 查询辅助：将结果转为对象数组 =====
// PostgreSQL 每次写入即持久化到磁盘，不像 sql.js 需要手动 export + 写文件，
// 因此不再需要 persist()/schedulePersist() 之类的落盘辅助函数。
// 注意：以下所有函数均使用 `?` 作为占位符风格对外暴露，内部自动转换为 PostgreSQL 的 $1/$2...，
// 这样上层 repositories 代码无需感知底层数据库差异，仅需将调用方式改为 async/await。

/** 将形如 `col = ? AND col2 = ?` 的占位符转换为 PostgreSQL 的 `$1, $2...` 形式 */
function toPgPlaceholders(sql: string): string {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

// 事务上下文：用 AsyncLocalStorage 在同一条异步调用链中透传当前事务的 client，
// 避免用全局可变变量在并发请求间互相污染（多个请求的事务会同时进行）。
const transactionContext = new AsyncLocalStorage<PoolClient>();

function getExecutor(): Pool | PoolClient {
  return transactionContext.getStore() ?? pool;
}

export async function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getExecutor().query(toPgPlaceholders(sql), params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await queryAll<T>(sql, params);
  return rows[0] ?? null;
}

export async function run(sql: string, params: unknown[] = []): Promise<void> {
  await getExecutor().query(toPgPlaceholders(sql), params);
}

/**
 * 在单个事务内执行一组写操作：全部成功才提交，任意一步失败则整体回滚，
 * 避免"半成品"数据（P0-2 事务保护 / P0-5 AI 批量保存的基础设施）。
 *
 * 通过 AsyncLocalStorage 把当前事务 client 挂载到本次调用链的上下文中，
 * 这样事务内部无论调用多少层函数（repositories -> run/queryOne），
 * 都会自动复用同一个 client，而不会从连接池另取新连接（避免并发事务互相串扰）。
 */
export async function runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await transactionContext.run(client, fn);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** 事务内部使用的写操作：与 run 行为一致（同样会自动复用当前事务 client），保留此别名以兼容旧调用点 */
export async function runRaw(sql: string, params: unknown[] = []): Promise<void> {
  await run(sql, params);
}

/** 进程退出前关闭连接池，释放资源 */
async function closePool(signal?: string) {
  try {
    await pool.end();
    console.log(`[DB] 连接池已关闭${signal ? `（信号: ${signal}）` : ''}`);
  } catch (err) {
    console.error('[DB] 关闭连接池失败：', err);
  }
}

process.on('SIGINT', async () => {
  await closePool('SIGINT');
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await closePool('SIGTERM');
  process.exit(0);
});
