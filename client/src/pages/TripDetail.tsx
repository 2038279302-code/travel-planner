import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { TripDetail, Activity, Expense, Note, Trip } from '../types';
import { TripApi, ActivityApi, ExpenseApi, NoteApi } from '../api';
import { useStore } from '../store/useStore';
import {
  TRIP_TYPE,
  TRIP_STATUS,
  ACTIVITY_CATEGORY,
  EXPENSE_CATEGORY,
} from '../utils/constants';
import { fmtDate, fmtMonthDay, tripDays, dayRange, fmtMoney } from '../utils/format';
import Modal from '../components/Modal';
import TripForm from '../components/TripForm';
import ActivityForm from '../components/ActivityForm';
import ExpenseForm from '../components/ExpenseForm';
import NoteForm from '../components/NoteForm';

type Tab = 'plan' | 'budget' | 'notes';

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useStore();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [tab, setTab] = useState<Tab>('plan');
  const [loading, setLoading] = useState(true);

  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await TripApi.detail(id);
      setTrip(data);
    } catch {
      toast('旅行不存在或已删除', 'error');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="text-center text-gray-400 py-20">加载中…</div>;
  if (!trip) return null;

  const handleUpdate = async (data: Partial<Trip>) => {
    await TripApi.update(trip.id, data);
    setShowEdit(false);
    toast('已更新');
    load();
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这趟旅行吗？所有行程、花销和记录都会被删除。')) return;
    await TripApi.remove(trip.id);
    toast('旅行已删除');
    navigate('/');
  };

  const st = TRIP_STATUS[trip.status];
  const days = dayRange(trip.startDate, trip.endDate);

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/')} className="text-gray-500 hover:text-brand-pink text-sm">
        ← 返回我的旅行
      </button>

      {/* 头部封面 */}
      <div className="card overflow-hidden animate-fade-up">
        <div
          className="h-32 sm:h-40 flex items-center justify-center text-7xl relative"
          style={{ background: trip.coverColor }}
        >
          <span className="drop-shadow-lg">{trip.coverEmoji}</span>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>{TRIP_TYPE[trip.type].emoji} {TRIP_TYPE[trip.type].label}</span>
                <span className="chip" style={{ color: st.color, background: st.bg }}>
                  {st.label}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-gray-800 mt-1">{trip.title}</h1>
              <p className="text-gray-500 mt-1 flex items-center gap-1">📍 {trip.destination}</p>
              {trip.description && (
                <p className="text-gray-400 text-sm mt-2 max-w-xl">{trip.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setShowEdit(true)}>✏️ 编辑</button>
              <button
                className="btn-ghost hover:!text-red-500"
                onClick={handleDelete}
              >
                🗑️ 删除
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-gray-500">
            <span>🗓️ {fmtDate(trip.startDate)} ~ {fmtDate(trip.endDate)}</span>
            <span>⏱️ 共 {tripDays(trip.startDate, trip.endDate)} 天</span>
            <span>💰 预算 {fmtMoney(trip.budget)}</span>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 p-1.5 bg-white/60 rounded-2xl w-fit">
        {([
          { k: 'plan', label: '📅 每日规划', n: trip.activities.length },
          { k: 'budget', label: '💸 预算花销', n: trip.expenses.length },
          { k: 'notes', label: '📝 旅行记录', n: trip.notes.length },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.k
                ? 'bg-gradient-to-r from-brand-pink to-brand-orange text-white shadow-glow'
                : 'text-gray-500 hover:bg-white'
            }`}
          >
            {t.label} {t.n > 0 && <span className="opacity-70">({t.n})</span>}
          </button>
        ))}
      </div>

      {tab === 'plan' && <PlanTab trip={trip} days={days} reload={load} />}
      {tab === 'budget' && <BudgetTab trip={trip} reload={load} />}
      {tab === 'notes' && <NotesTab trip={trip} reload={load} />}

      <Modal open={showEdit} title="✏️ 编辑旅行" onClose={() => setShowEdit(false)}>
        <TripForm initial={trip} onSubmit={handleUpdate} onCancel={() => setShowEdit(false)} />
      </Modal>
    </div>
  );
}

/* ============ 每日规划 Tab ============ */
function PlanTab({
  trip,
  days,
  reload,
}: {
  trip: TripDetail;
  days: string[];
  reload: () => void;
}) {
  const { toast } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [formDay, setFormDay] = useState<string | undefined>();

  const openAdd = (day?: string) => {
    setEditing(null);
    setFormDay(day);
    setShowForm(true);
  };
  const openEdit = (a: Activity) => {
    setEditing(a);
    setShowForm(true);
  };

  const handleSubmit = async (data: Partial<Activity>) => {
    if (editing) {
      await ActivityApi.update(trip.id, editing.id, data);
      toast('行程已更新');
    } else {
      await ActivityApi.create(trip.id, data);
      toast('行程已添加 🎉');
    }
    setShowForm(false);
    reload();
  };

  const toggleDone = async (a: Activity) => {
    await ActivityApi.update(trip.id, a.id, { done: !a.done });
    reload();
  };

  const remove = async (a: Activity) => {
    if (!confirm('删除这个行程项？')) return;
    await ActivityApi.remove(trip.id, a.id);
    toast('已删除');
    reload();
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {days.map((day, idx) => {
        // 统一转为 YYYY-MM-DD 比较，避免 ISO 字符串格式不一致导致的匹配失败
        const dayStr = fmtDate(day);
        const items = trip.activities.filter((a) => fmtDate(a.dayDate) === dayStr);
        return (
          <div key={day} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-pink to-brand-orange text-white flex items-center justify-center font-bold text-sm">
                  D{idx + 1}
                </span>
                <div>
                  <div className="font-bold text-gray-800">第 {idx + 1} 天</div>
                  <div className="text-xs text-gray-400">{fmtMonthDay(day)}</div>
                </div>
              </div>
              <button
                onClick={() => openAdd(day)}
                className="text-sm text-brand-pink hover:underline"
              >
                ＋ 添加
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-gray-300 py-3 text-center">这一天还没有安排～</p>
            ) : (
              <div className="space-y-2">
                {items.map((a) => {
                  const cat = ACTIVITY_CATEGORY[a.category];
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 group transition-colors"
                    >
                      <button
                        onClick={() => toggleDone(a)}
                        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs transition-colors ${
                          a.done
                            ? 'bg-brand-green border-brand-green text-white'
                            : 'border-gray-300 text-transparent hover:border-brand-pink'
                        }`}
                      >
                        ✓
                      </button>
                      <span
                        className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: cat.color + '22' }}
                      >
                        {cat.emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${a.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {a.startTime && <span className="text-brand-pink mr-2">{a.startTime}</span>}
                          {a.title}
                        </div>
                        <div className="text-xs text-gray-400 flex gap-2 flex-wrap">
                          <span>{cat.label}</span>
                          {a.location && <span>· 📍{a.location}</span>}
                          {a.cost > 0 && <span>· {fmtMoney(a.cost)}</span>}
                          {a.note && <span>· {a.note}</span>}
                        </div>
                      </div>
                      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button onClick={() => openEdit(a)} className="text-gray-400 hover:text-brand-blue text-sm px-1">✏️</button>
                        <button onClick={() => remove(a)} className="text-gray-400 hover:text-red-500 text-sm px-1">🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <Modal
        open={showForm}
        title={editing ? '✏️ 编辑行程' : '✨ 添加行程'}
        onClose={() => setShowForm(false)}
      >
        <ActivityForm
          days={days}
          defaultDay={formDay}
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}

/* ============ 预算花销 Tab ============ */
function BudgetTab({ trip, reload }: { trip: TripDetail; reload: () => void }) {
  const { toast } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const total = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const pct = trip.budget > 0 ? Math.min(100, (total / trip.budget) * 100) : 0;
  const over = trip.budget > 0 && total > trip.budget;

  // 分类汇总
  const byCat = trip.expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  const handleSubmit = async (data: Partial<Expense>) => {
    if (editing) {
      await ExpenseApi.update(trip.id, editing.id, data);
      toast('已更新');
    } else {
      await ExpenseApi.create(trip.id, data);
      toast('花销已记录 💸');
    }
    setShowForm(false);
    reload();
  };

  const remove = async (e: Expense) => {
    if (!confirm('删除这条花销？')) return;
    await ExpenseApi.remove(trip.id, e.id);
    toast('已删除');
    reload();
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* 预算概览 */}
      <div className="card p-5">
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="text-sm text-gray-400">已花费</div>
            <div className={`text-3xl font-extrabold ${over ? 'text-red-500' : 'text-gray-800'}`}>
              {fmtMoney(total)}
            </div>
          </div>
          <div className="text-right text-sm text-gray-400">
            预算 {fmtMoney(trip.budget)}
            <div className={over ? 'text-red-500' : 'text-brand-green'}>
              {over ? `超支 ${fmtMoney(total - trip.budget)}` : `剩余 ${fmtMoney(trip.budget - total)}`}
            </div>
          </div>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : 'bg-gradient-to-r from-brand-pink to-brand-orange'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* 分类条 */}
        {Object.keys(byCat).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {Object.entries(byCat).map(([k, v]) => {
              const c = EXPENSE_CATEGORY[k as keyof typeof EXPENSE_CATEGORY];
              return (
                <span key={k} className="chip bg-gray-100 text-gray-600">
                  {c.emoji} {c.label} {fmtMoney(v)}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-bold text-gray-700">花销明细</h3>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          ＋ 记一笔
        </button>
      </div>

      {trip.expenses.length === 0 ? (
        <div className="card p-10 text-center text-gray-300">还没有花销记录～</div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {trip.expenses.map((e) => {
            const c = EXPENSE_CATEGORY[e.category];
            return (
              <div key={e.id} className="flex items-center gap-3 p-4 group">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: c.color + '22' }}
                >
                  {c.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate">{e.title}</div>
                  <div className="text-xs text-gray-400">{c.label} · {fmtDate(e.date)}</div>
                </div>
                <div className="font-bold text-gray-700">{fmtMoney(e.amount)}</div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
                  <button onClick={() => { setEditing(e); setShowForm(true); }} className="text-gray-400 hover:text-brand-blue text-sm">✏️</button>
                  <button onClick={() => remove(e)} className="text-gray-400 hover:text-red-500 text-sm">🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showForm}
        title={editing ? '✏️ 编辑花销' : '💸 记一笔'}
        onClose={() => setShowForm(false)}
      >
        <ExpenseForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}

/* ============ 旅行记录 Tab ============ */
function NotesTab({ trip, reload }: { trip: TripDetail; reload: () => void }) {
  const { toast } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);

  const handleSubmit = async (data: Partial<Note>) => {
    if (editing) {
      await NoteApi.update(trip.id, editing.id, data);
      toast('记录已更新');
    } else {
      await NoteApi.create(trip.id, data);
      toast('记录已保存 📝');
    }
    setShowForm(false);
    reload();
  };

  const remove = async (n: Note) => {
    if (!confirm('删除这条记录？')) return;
    await NoteApi.remove(trip.id, n.id);
    toast('已删除');
    reload();
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          ＋ 写记录
        </button>
      </div>

      {trip.notes.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl animate-float">📖</div>
          <p className="text-gray-400 mt-3">还没有旅行记录，写下第一篇手账吧～</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 gap-5 space-y-5">
          {trip.notes.map((n) => (
            <div key={n.id} className="card p-5 break-inside-avoid group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{n.mood}</span>
                  <div>
                    {n.title && <div className="font-bold text-gray-800">{n.title}</div>}
                    <div className="text-xs text-gray-400">{fmtDate(n.date)}</div>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => { setEditing(n); setShowForm(true); }} className="text-gray-400 hover:text-brand-blue text-sm">✏️</button>
                  <button onClick={() => remove(n)} className="text-gray-400 hover:text-red-500 text-sm">🗑️</button>
                </div>
              </div>
              <p className="text-gray-600 text-sm mt-3 whitespace-pre-wrap leading-relaxed">
                {n.content}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        title={editing ? '✏️ 编辑记录' : '📝 写旅行记录'}
        onClose={() => setShowForm(false)}
      >
        <NoteForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}
