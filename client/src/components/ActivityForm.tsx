import { useState } from 'react';
import type { Activity, ActivityCategory } from '../types';
import { ACTIVITY_CATEGORY } from '../utils/constants';
import { fmtDate, localDateToISO } from '../utils/format';

interface Props {
  days: string[]; // 可选日期（ISO）
  defaultDay?: string;
  initial?: Partial<Activity>;
  onSubmit: (data: Partial<Activity>) => void | Promise<void>;
  onCancel: () => void;
}

export default function ActivityForm({
  days,
  defaultDay,
  initial,
  onSubmit,
  onCancel,
}: Props) {
  // 统一用 YYYY-MM-DD 作为内部状态，避免时区问题
  const [dayDate, setDayDate] = useState<string>(() => {
    const raw = initial?.dayDate ?? defaultDay ?? days[0] ?? '';
    return raw ? fmtDate(raw) : fmtDate(days[0] ?? new Date().toISOString());
  });
  const [startTime, setStartTime] = useState(initial?.startTime ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<ActivityCategory>(
    initial?.category ?? 'sightseeing'
  );
  const [location, setLocation] = useState(initial?.location ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [cost, setCost] = useState(String(initial?.cost ?? ''));
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        dayDate: localDateToISO(dayDate), // 本地时间转 ISO，避免时区偏移
        startTime: startTime || null,
        title: title.trim(),
        category,
        location: location.trim() || null,
        note: note.trim() || null,
        cost: Number(cost) || 0,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">日期</label>
          <select
            className="input"
            value={dayDate}
            onChange={(e) => setDayDate(e.target.value)}
          >
            {days.map((d) => {
              const val = fmtDate(d);
              return (
                <option key={d} value={val}>
                  {val}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-500 mb-1 block">时间</label>
          <input
            type="time"
            className="input"
            value={startTime ?? ''}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1 block">安排 *</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：参观浅草寺"
        />
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1.5 block">类别</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ACTIVITY_CATEGORY).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setCategory(k as ActivityCategory)}
              className={`chip px-3 py-1.5 ${
                category === k ? 'text-white shadow-soft' : 'bg-gray-100 text-gray-500'
              }`}
              style={category === k ? { background: v.color } : undefined}
            >
              {v.emoji} {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">地点</label>
          <input
            className="input"
            value={location ?? ''}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="选填"
          />
        </div>
        <div>
          <label className="text-sm text-gray-500 mb-1 block">预计花费（¥）</label>
          <input
            type="number"
            className="input"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1 block">备注</label>
        <textarea
          className="input resize-none"
          rows={2}
          value={note ?? ''}
          onChange={(e) => setNote(e.target.value)}
          placeholder="选填"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button className="btn-ghost flex-1" onClick={onCancel}>
          取消
        </button>
        <button className="btn-primary flex-1" onClick={submit} disabled={submitting}>
          {submitting ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  );
}
