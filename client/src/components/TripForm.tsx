import { useState } from 'react';
import type { Trip, TripType, TripStatus } from '../types';
import {
  TRIP_TYPE,
  TRIP_STATUS,
  COVER_COLORS,
  COVER_EMOJIS,
} from '../utils/constants';
import { fmtDate, localDateToISO } from '../utils/format';

interface Props {
  initial?: Partial<Trip>;
  onSubmit: (data: Partial<Trip>) => void | Promise<void>;
  onCancel: () => void;
}

export default function TripForm({ initial, onSubmit, onCancel }: Props) {
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

  const handleSubmit = async () => {
    if (!title.trim() || !destination.trim() || !startDate || !endDate) {
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
        budget: Number(budget) || 0,
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
        <label className="text-sm text-gray-500 mb-1 block">旅行标题 *</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：东京樱花之旅"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">类型</label>
          <select
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
          <label className="text-sm text-gray-500 mb-1 block">状态</label>
          <select
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
        <label className="text-sm text-gray-500 mb-1 block">目的地 *</label>
        <input
          className="input"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="例如：日本·东京"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">开始日期 *</label>
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-gray-500 mb-1 block">结束日期 *</label>
          <input
            type="date"
            className="input"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1 block">预算（¥）</label>
        <input
          type="number"
          className="input"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="0"
        />
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1 block">简介</label>
        <textarea
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
        <div className="flex flex-wrap gap-2">
          {COVER_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setCoverColor(c)}
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
        <div className="flex flex-wrap gap-1.5">
          {COVER_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setCoverEmoji(e)}
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
