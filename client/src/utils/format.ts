/** 格式化日期为 YYYY-MM-DD（避免时区偏移） */
export function fmtDate(iso: string): string {
  // 如果已经是 YYYY-MM-DD 格式，直接返回
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 将 YYYY-MM-DD 字符串转为当天本地时间的 ISO 字符串（避免时区偏移少一天） */
export function localDateToISO(dateStr: string): string {
  // dateStr 格式：YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

/** 格式化为 M月D日 */
export function fmtMonthDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 计算旅行天数 */
export function tripDays(start: string, end: string): number {
  const s = new Date(fmtDate(start)).getTime();
  const e = new Date(fmtDate(end)).getTime();
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

/** 生成旅行的每一天日期数组（ISO，按天 00:00） */
export function dayRange(start: string, end: string): string[] {
  const days: string[] = [];
  const s = new Date(fmtDate(start));
  const e = new Date(fmtDate(end));
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d).toISOString());
  }
  return days;
}

/** 金额格式化 ¥1,234 */
export function fmtMoney(n: number): string {
  return '¥' + n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

/** 点赞数格式化 12.8k */
export function fmtLikes(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

/** 同一天判断 */
export function isSameDay(a: string, b: string): boolean {
  return fmtDate(a) === fmtDate(b);
}

/** "HH:mm" 转当天分钟数，便于比较 */
function timeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * 判断两个行程项的时间段是否重叠。
 * - 双方都填了开始和结束时间：按真实区间判断重叠。
 * - 只填了开始时间（无结束时间）：默认占用 1 小时，用于粗略判断。
 * - 任一方都没填开始时间：视为不冲突（无法判断）。
 */
export function isTimeOverlap(
  a: { startTime: string | null; endTime?: string | null },
  b: { startTime: string | null; endTime?: string | null }
): boolean {
  if (!a.startTime || !b.startTime) return false;
  const aStart = timeToMinutes(a.startTime);
  const bStart = timeToMinutes(b.startTime);
  if (aStart === null || bStart === null) return false;

  const DEFAULT_DURATION = 60; // 未填结束时间时的默认占用时长（分钟）
  const aEnd = (a.endTime && timeToMinutes(a.endTime)) || aStart + DEFAULT_DURATION;
  const bEnd = (b.endTime && timeToMinutes(b.endTime)) || bStart + DEFAULT_DURATION;

  return aStart < bEnd && bStart < aEnd;
}
