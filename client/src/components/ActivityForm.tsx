import { useRef, useState } from 'react';
import type { Activity, ActivityCategory } from '../types';
import { ACTIVITY_CATEGORY } from '../utils/constants';
import { fmtDate, localDateToISO } from '../utils/format';
import { validateNumberInput, MAX_COST } from '../utils/validation';
import FieldError from './FieldError';
import { useStore } from '../store/useStore';

interface Props {
  days: string[]; // 可选日期（ISO）
  defaultDay?: string;
  initial?: Partial<Activity>;
  onSubmit: (data: Partial<Activity>) => void | Promise<void>;
  onCancel: () => void;
}

type FormErrors = Partial<Record<'title' | 'time' | 'cost', string>>;

export default function ActivityForm({
  days,
  defaultDay,
  initial,
  onSubmit,
  onCancel,
}: Props) {
  const { toast } = useStore();
  // 统一用 YYYY-MM-DD 作为内部状态，避免时区问题
  const [dayDate, setDayDate] = useState<string>(() => {
    const raw = initial?.dayDate ?? defaultDay ?? days[0] ?? '';
    return raw ? fmtDate(raw) : fmtDate(days[0] ?? new Date().toISOString());
  });
  const [startTime, setStartTime] = useState(initial?.startTime ?? '');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<ActivityCategory>(
    initial?.category ?? 'sightseeing'
  );
  const [location, setLocation] = useState(initial?.location ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [cost, setCost] = useState(String(initial?.cost ?? ''));
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const endTimeRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const costRef = useRef<HTMLInputElement>(null);
  const fieldRefs = { time: endTimeRef, title: titleRef, cost: costRef };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!title.trim()) next.title = '请填写安排内容';
    if (startTime && endTime && endTime <= startTime) next.time = '结束时间需晚于开始时间';
    // 严格校验花费输入：非法字符、负数、超出上限都直接拦截（P1-2）
    const costError = validateNumberInput(cost, { label: '花费', max: MAX_COST });
    if (costError) next.cost = costError;
    return next;
  };

  const submit = async () => {
    const next = validate();
    setErrors(next);
    const firstErrorKey = (Object.keys(next) as (keyof FormErrors)[])[0];
    if (firstErrorKey) {
      toast('请检查表单中标红的字段', 'error');
      fieldRefs[firstErrorKey]?.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        dayDate: localDateToISO(dayDate), // 本地时间转 ISO，避免时区偏移
        startTime: startTime || null,
        endTime: endTime || null,
        title: title.trim(),
        category,
        location: location.trim() || null,
        note: note.trim() || null,
        cost: cost.trim() ? Number(cost) : 0,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="activity-day" className="text-sm text-gray-500 mb-1 block">日期</label>
          <select
            id="activity-day"
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
          <label htmlFor="activity-start-time" className="text-sm text-gray-500 mb-1 block">开始时间</label>
          <input
            id="activity-start-time"
            type="time"
            className={`input ${errors.time ? 'input-error' : ''}`}
            value={startTime ?? ''}
            onChange={(e) => {
              setStartTime(e.target.value);
              if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
            }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="activity-end-time" className="text-sm text-gray-500 mb-1 block">
          结束时间 <span className="text-gray-300">（选填，用于时间冲突检测）</span>
        </label>
        <input
          id="activity-end-time"
          ref={endTimeRef}
          type="time"
          className={`input ${errors.time ? 'input-error' : ''}`}
          value={endTime ?? ''}
          onChange={(e) => {
            setEndTime(e.target.value);
            if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
          }}
          aria-invalid={!!errors.time}
          aria-describedby={errors.time ? 'activity-time-error' : undefined}
        />
        <FieldError id="activity-time-error" message={errors.time} />
      </div>

      <div>
        <label htmlFor="activity-title" className="text-sm text-gray-500 mb-1 block">安排 *</label>
        <input
          id="activity-title"
          ref={titleRef}
          className={`input ${errors.title ? 'input-error' : ''}`}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
          }}
          placeholder="例如：参观浅草寺"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'activity-title-error' : undefined}
        />
        <FieldError id="activity-title-error" message={errors.title} />
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1.5 block">类别</label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="类别">
          {Object.entries(ACTIVITY_CATEGORY).map(([k, v]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={category === k}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="activity-location" className="text-sm text-gray-500 mb-1 block">地点</label>
          <input
            id="activity-location"
            className="input"
            value={location ?? ''}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="选填"
          />
        </div>
        <div>
          <label htmlFor="activity-cost" className="text-sm text-gray-500 mb-1 block">预计花费（¥）</label>
          <input
            id="activity-cost"
            ref={costRef}
            type="number"
            min={0}
            className={`input ${errors.cost ? 'input-error' : ''}`}
            value={cost}
            onChange={(e) => {
              setCost(e.target.value);
              if (errors.cost) setErrors((prev) => ({ ...prev, cost: undefined }));
            }}
            placeholder="0"
            aria-invalid={!!errors.cost}
            aria-describedby={errors.cost ? 'activity-cost-error' : undefined}
          />
          <FieldError id="activity-cost-error" message={errors.cost} />
        </div>
      </div>

      <div>
        <label htmlFor="activity-note" className="text-sm text-gray-500 mb-1 block">备注</label>
        <textarea
          id="activity-note"
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
