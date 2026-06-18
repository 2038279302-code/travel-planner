import { useState } from 'react';
import type { Expense, ExpenseCategory } from '../types';
import { EXPENSE_CATEGORY } from '../utils/constants';
import { fmtDate, localDateToISO } from '../utils/format';

interface Props {
  initial?: Partial<Expense>;
  onSubmit: (data: Partial<Expense>) => void | Promise<void>;
  onCancel: () => void;
}

export default function ExpenseForm({ initial, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<ExpenseCategory>(
    initial?.category ?? 'food'
  );
  const [amount, setAmount] = useState(String(initial?.amount ?? ''));
  const [date, setDate] = useState(
    initial?.date ? fmtDate(initial.date) : fmtDate(new Date().toISOString())
  );
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim() || !amount) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        category,
        amount: Number(amount) || 0,
        date: localDateToISO(date), // 本地时间转 ISO，避免时区偏移少一天
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-gray-500 mb-1 block">项目 *</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：往返机票"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">金额（¥）*</label>
          <input
            type="number"
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
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
        <label className="text-sm text-gray-500 mb-1.5 block">类别</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(EXPENSE_CATEGORY).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setCategory(k as ExpenseCategory)}
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
