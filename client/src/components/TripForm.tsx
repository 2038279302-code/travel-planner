import { useRef, useState } from 'react';
import type { Trip, TripType, TripStatus } from '../types';
import {
  TRIP_TYPE,
  TRIP_STATUS,
  COVER_COLORS,
  COVER_EMOJIS,
} from '../utils/constants';
import { fmtDate, localDateToISO } from '../utils/format';
import { validateNumberInput, MAX_BUDGET } from '../utils/validation';
import FieldError from './FieldError';
import { useStore } from '../store/useStore';

interface Props {
  initial?: Partial<Trip>;
  onSubmit: (data: Partial<Trip>) => void | Promise<void>;
  onCancel: () => void;
}

type FormErrors = Partial<Record<'title' | 'destination' | 'startDate' | 'endDate' | 'budget', string>>;

export default function TripForm({ initial, onSubmit, onCancel }: Props) {
  const { toast } = useStore();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState<TripType>(initial?.type ?? 'travel');
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [startDate, setStartDate] = useState(
    initial?.startDate ? fmtDate(initial.startDate) : ''
  );
  const [endDate, setEndDate] = useState(
    initial?.endDate ? fmtDate(initial.endDate) : ''
  );
  const [budget, setBudget] = useState(String(initial?.budget ?? ''));
  const [status, setStatus] = useState<TripStatus>(initial?.status ?? 'planning');
  const [coverColor, setCoverColor] = useState(initial?.coverColor ?? COVER_COLORS[0]);
  const [coverEmoji, setCoverEmoji] = useState(initial?.coverEmoji ?? COVER_EMOJIS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const titleRef = useRef<HTMLInputElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const budgetRef = useRef<HTMLInputElement>(null);
  const fieldRefs = { title: titleRef, destination: destinationRef, startDate: startDateRef, endDate: endDateRef, budget: budgetRef };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!title.trim()) next.title = '请填写旅行标题';
    if (!destination.trim()) next.destination = '请填写目的地';
    if (!startDate) next.startDate = '请选择开始日期';
    if (!endDate) next.endDate = '请选择结束日期';
    if (startDate && endDate && endDate < startDate) next.endDate = '结束日期不能早于开始日期';
    // 严格校验预算输入：非法字符、负数、超出上限都直接拦截，避免被静默转成 0（P1-2）
    const budgetError = validateNumberInput(budget, { label: '预算', max: MAX_BUDGET });
    if (budgetError) next.budget = budgetError;
    return next;
  };

  const handleSubmit = async () => {
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
        title: title.trim(),
        type,
        destination: destination.trim(),
        description: description.trim() || null,
        startDate: localDateToISO(startDate), // 本地时间转 ISO，避免时区偏移
        endDate: localDateToISO(endDate),
        budget: budget.trim() ? Number(budget) : 0,
        status,
        coverColor,
        coverEmoji,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 封面预览 */}
      <div
        className="rounded-2xl h-24 flex items-center justify-center text-5xl shadow-soft"
        style={{ background: coverColor }}
      >
        {coverEmoji}
      </div>

      <div>
        <label htmlFor="trip-title" className="text-sm text-gray-500 mb-1 block">旅行标题 *</label>
        <input
          id="trip-title"
          ref={titleRef}
          className={`input ${errors.title ? 'input-error' : ''}`}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
          }}
          placeholder="例如：东京樱花之旅"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'trip-title-error' : undefined}
        />
        <FieldError id="trip-title-error" message={errors.title} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="trip-type" className="text-sm text-gray-500 mb-1 block">类型</label>
          <select
            id="trip-type"
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as TripType)}
          >
            {Object.entries(TRIP_TYPE).map(([k, v]) => (
              <option key={k} value={k}>
                {v.emoji} {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="trip-status" className="text-sm text-gray-500 mb-1 block">状态</label>
          <select
            id="trip-status"
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as TripStatus)}
          >
            {Object.entries(TRIP_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="trip-destination" className="text-sm text-gray-500 mb-1 block">目的地 *</label>
        <input
          id="trip-destination"
          ref={destinationRef}
          className={`input ${errors.destination ? 'input-error' : ''}`}
          value={destination}
          onChange={(e) => {
            setDestination(e.target.value);
            if (errors.destination) setErrors((prev) => ({ ...prev, destination: undefined }));
          }}
          placeholder="例如：日本·东京"
          aria-invalid={!!errors.destination}
          aria-describedby={errors.destination ? 'trip-destination-error' : undefined}
        />
        <FieldError id="trip-destination-error" message={errors.destination} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="trip-start-date" className="text-sm text-gray-500 mb-1 block">开始日期 *</label>
          <input
            id="trip-start-date"
            ref={startDateRef}
            type="date"
            className={`input ${errors.startDate ? 'input-error' : ''}`}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setErrors((prev) => ({ ...prev, startDate: undefined }));
            }}
            aria-invalid={!!errors.startDate}
            aria-describedby={errors.startDate ? 'trip-start-date-error' : undefined}
          />
          <FieldError id="trip-start-date-error" message={errors.startDate} />
        </div>
        <div>
          <label htmlFor="trip-end-date" className="text-sm text-gray-500 mb-1 block">结束日期 *</label>
          <input
            id="trip-end-date"
            ref={endDateRef}
            type="date"
            className={`input ${errors.endDate ? 'input-error' : ''}`}
            value={endDate}
            min={startDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setErrors((prev) => ({ ...prev, endDate: undefined }));
            }}
            aria-invalid={!!errors.endDate}
            aria-describedby={errors.endDate ? 'trip-end-date-error' : undefined}
          />
          <FieldError id="trip-end-date-error" message={errors.endDate} />
        </div>
      </div>

      <div>
        <label htmlFor="trip-budget" className="text-sm text-gray-500 mb-1 block">预算（¥）</label>
        <input
          id="trip-budget"
          ref={budgetRef}
          type="number"
          min={0}
          className={`input ${errors.budget ? 'input-error' : ''}`}
          value={budget}
          onChange={(e) => {
            setBudget(e.target.value);
            if (errors.budget) setErrors((prev) => ({ ...prev, budget: undefined }));
          }}
          placeholder="0"
          aria-invalid={!!errors.budget}
          aria-describedby={errors.budget ? 'trip-budget-error' : undefined}
        />
        <FieldError id="trip-budget-error" message={errors.budget} />
      </div>

      <div>
        <label htmlFor="trip-description" className="text-sm text-gray-500 mb-1 block">简介</label>
        <textarea
          id="trip-description"
          className="input resize-none"
          rows={2}
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="这趟旅程的小目标～"
        />
      </div>

      {/* 主题色 */}
      <div>
        <label className="text-sm text-gray-500 mb-1.5 block">主题色</label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="主题色">
          {COVER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCoverColor(c)}
              role="radio"
              aria-checked={coverColor === c}
              aria-label={`主题色 ${c}`}
              className={`w-8 h-8 rounded-full transition-transform ${
                coverColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* Emoji */}
      <div>
        <label className="text-sm text-gray-500 mb-1.5 block">封面图标</label>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="封面图标">
          {COVER_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setCoverEmoji(e)}
              role="radio"
              aria-checked={coverEmoji === e}
              aria-label={`封面图标 ${e}`}
              className={`w-9 h-9 rounded-xl text-lg transition-all ${
                coverEmoji === e
                  ? 'bg-brand-pink/15 ring-2 ring-brand-pink/40 scale-110'
                  : 'hover:bg-gray-100'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button className="btn-ghost flex-1" onClick={onCancel}>
          取消
        </button>
        <button className="btn-primary flex-1" onClick={handleSubmit} disabled={submitting}>
          {submitting ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  );
}
