import { useState } from 'react';
import type { Note } from '../types';
import { fmtDate, localDateToISO } from '../utils/format';

const MOODS = ['😊', '🥰', '😎', '🤩', '😌', '😋', '🥳', '😮', '🥹', '😴'];

interface Props {
  initial?: Partial<Note>;
  onSubmit: (data: Partial<Note>) => void | Promise<void>;
  onCancel: () => void;
}

export default function NoteForm({ initial, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [mood, setMood] = useState(initial?.mood ?? '😊');
  const [date, setDate] = useState(
    initial?.date ? fmtDate(initial.date) : fmtDate(new Date().toISOString())
  );
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim() || null,
        content: content.trim(),
        mood,
        date: localDateToISO(date), // 本地时间转 ISO，避免时区偏移少一天
        images: [],
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">标题</label>
          <input
            className="input"
            value={title ?? ''}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="选填"
          />
        </div>
        <div>
          <label className="text-sm text-gray-500 mb-1 block">日期</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1.5 block">心情</label>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => setMood(m)}
              className={`w-9 h-9 rounded-xl text-lg transition-all ${
                mood === m
                  ? 'bg-brand-pink/15 ring-2 ring-brand-pink/40 scale-110'
                  : 'hover:bg-gray-100'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1 block">记录正文 *</label>
        <textarea
          className="input resize-none"
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="写下此刻的所见所感～"
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
