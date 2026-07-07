import { useRef, useState } from 'react';
import type { Expense, ExpenseCategory } from '../types';
import { EXPENSE_CATEGORY } from '../utils/constants';
import { fmtDate, localDateToISO } from '../utils/format';
import FieldError from './FieldError';
import { useStore } from '../store/useStore';

interface Props {
  initial?: Partial<Expense>;
  onSubmit: (data: Partial<Expense>) => void | Promise<void>;
  onCancel: () => void;
}

type FormErrors = Partial<Record<'title' | 'amount', string>>;

export default function ExpenseForm({ initial, onSubmit, onCancel }: Props) {
  const { toast } = useStore();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<ExpenseCategory>(
    initial?.category ?? 'food'
  );
  const [amount, setAmount] = useState(String(initial?.amount ?? ''));
  const [date, setDate] = useState(
    initial?.date ? fmtDate(initial.date) : fmtDate(new Date().toISOString())
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const titleRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const fieldRefs = { title: titleRef, amount: amountRef };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!title.trim()) next.title = '请填写花销项目';
    if (!amount) next.amount = '请填写金额';
    else if (Number(amount) <= 0) next.amount = '金额需大于 0';
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
        <label htmlFor="expense-title" className="text-sm text-gray-500 mb-1 block">项目 *</label>
        <input
          id="expense-title"
          ref={titleRef}
          className={`input ${errors.title ? 'input-error' : ''}`}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
          }}
          placeholder="例如：往返机票"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'expense-title-error' : undefined}
        />
        <FieldError id="expense-title-error" message={errors.title} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="expense-amount" className="text-sm text-gray-500 mb-1 block">金额（¥）*</label>
          <input
            id="expense-amount"
            ref={amountRef}
            type="number"
            min={0}
            className={`input ${errors.amount ? 'input-error' : ''}`}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
            }}
            placeholder="0"
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount ? 'expense-amount-error' : undefined}
          />
          <FieldError id="expense-amount-error" message={errors.amount} />
        </div>
        <div>
          <label htmlFor="expense-date" className="text-sm text-gray-500 mb-1 block">日期</label>
          <input
            id="expense-date"
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1.5 block">类别</label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="类别">
          {Object.entries(EXPENSE_CATEGORY).map(([k, v]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={category === k}
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
