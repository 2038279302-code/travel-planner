import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { TripDetail, Activity, Expense, Note, Trip } from '../types';
import { TripApi, ActivityApi, ExpenseApi, NoteApi } from '../api';
import { useStore } from '../store/useStore';
import {
  TRIP_TYPE,
  TRIP_STATUS,
  ACTIVITY_CATEGORY,
  EXPENSE_CATEGORY,
} from '../utils/constants';
import {
  fmtDate,
  fmtMonthDay,
  tripDays,
  dayRange,
  fmtMoney,
  isTimeOverlap,
} from '../utils/format';
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
  // 拖拽过程中的本地乐观状态：拖拽结束前用它渲染，避免等待接口往返造成的闪烁
  const [localActivities, setLocalActivities] = useState<Activity[] | null>(null);

  const activities = localActivities ?? trip.activities;

  // trip 数据刷新后清空本地覆盖，改用最新的服务端数据
  useEffect(() => {
    setLocalActivities(null);
  }, [trip.activities]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

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

  // 按天分组，并计算每天内的时间冲突集合
  const dayGroups = days.map((day) => {
    const dayStr = fmtDate(day);
    const items = activities
      .filter((a) => fmtDate(a.dayDate) === dayStr)
      .sort((a, b) => a.order - b.order);
    const conflictIds = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (isTimeOverlap(items[i], items[j])) {
          conflictIds.add(items[i].id);
          conflictIds.add(items[j].id);
        }
      }
    }
    return { day, dayStr, items, conflictIds };
  });

  const findContainer = (activityId: string) =>
    dayGroups.find((g) => g.items.some((a) => a.id === activityId))?.dayStr;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    // over.id 可能是行程项 id（悬停在某一项上），也可能是某天容器的 id（day:YYYY-MM-DD，悬停在空白处）
    const overIdRaw = String(over.id);
    const overIsContainer = overIdRaw.startsWith('day:');
    const overDayStr = overIsContainer ? overIdRaw.slice(4) : findContainer(overIdRaw);
    const fromDayStr = findContainer(activeId);
    if (!overDayStr || !fromDayStr) return;

    const fromGroup = dayGroups.find((g) => g.dayStr === fromDayStr)!;
    const toGroup = dayGroups.find((g) => g.dayStr === overDayStr)!;
    const activeItem = fromGroup.items.find((a) => a.id === activeId);
    if (!activeItem) return;

    let nextFromItems = fromGroup.items;
    let nextToItems: Activity[];

    if (fromDayStr === overDayStr) {
      // 同一天内重排
      const oldIndex = fromGroup.items.findIndex((a) => a.id === activeId);
      const newIndex = overIsContainer
        ? fromGroup.items.length - 1
        : fromGroup.items.findIndex((a) => a.id === overIdRaw);
      if (oldIndex === newIndex || newIndex < 0) return;
      nextToItems = arrayMove(fromGroup.items, oldIndex, newIndex);
      nextFromItems = nextToItems;
    } else {
      // 跨天移动
      nextFromItems = fromGroup.items.filter((a) => a.id !== activeId);
      const insertAt = overIsContainer
        ? toGroup.items.length
        : toGroup.items.findIndex((a) => a.id === overIdRaw);
      const movedItem = { ...activeItem, dayDate: toGroup.day };
      nextToItems = [...toGroup.items];
      nextToItems.splice(insertAt < 0 ? nextToItems.length : insertAt, 0, movedItem);
    }

    // 乐观更新本地状态，交互上立即看到结果
    const updatedIds = new Set([
      ...nextFromItems.map((a) => a.id),
      ...nextToItems.map((a) => a.id),
    ]);
    const merged = activities
      .filter((a) => !updatedIds.has(a.id))
      .concat(
        fromDayStr === overDayStr
          ? nextToItems.map((a, i) => ({ ...a, order: i }))
          : [
              ...nextFromItems.map((a, i) => ({ ...a, order: i })),
              ...nextToItems.map((a, i) => ({ ...a, order: i })),
            ]
      );
    setLocalActivities(merged);

    // 提交到服务端：一次性批量更新受影响的行程项
    const payload =
      fromDayStr === overDayStr
        ? nextToItems.map((a, i) => ({ id: a.id, dayDate: a.dayDate, order: i }))
        : [
            ...nextFromItems.map((a, i) => ({ id: a.id, dayDate: a.dayDate, order: i })),
            ...nextToItems.map((a, i) => ({ id: a.id, dayDate: a.dayDate, order: i })),
          ];

    try {
      await ActivityApi.reorder(trip.id, payload);
      if (fromDayStr !== overDayStr) toast('已移动到新的一天');
      reload();
    } catch {
      toast('排序保存失败，请重试', 'error');
      setLocalActivities(null);
      reload();
    }
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {dayGroups.map(({ day, dayStr, items, conflictIds }, idx) => (
          <DroppableDay key={day} id={`day:${dayStr}`}>
            <div className="card p-5">
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

              {conflictIds.size > 0 && (
                <div className="mb-3 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2 flex items-center gap-1.5">
                  ⚠️ 这一天有行程时间冲突，标红的项存在时间重叠，建议调整
                </div>
              )}

              {items.length === 0 ? (
                <p className="text-sm text-gray-300 py-3 text-center">这一天还没有安排～</p>
              ) : (
                <SortableContext
                  items={items.map((a) => a.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {items.map((a) => (
                      <SortableActivityItem
                        key={a.id}
                        activity={a}
                        conflict={conflictIds.has(a.id)}
                        onToggleDone={() => toggleDone(a)}
                        onEdit={() => openEdit(a)}
                        onRemove={() => remove(a)}
                      />
                    ))}
                  </div>
                </SortableContext>
              )}
            </div>
          </DroppableDay>
        ))}
      </DndContext>

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

/** 每一天的可放置容器：承载该天的 SortableContext，空白处也能接住跨天拖入的行程项 */
function DroppableDay({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl transition-shadow ${isOver ? 'ring-2 ring-brand-pink/40' : ''}`}
    >
      {children}
    </div>
  );
}

/** 可拖拽排序的单个行程项 */
function SortableActivityItem({
  activity: a,
  conflict,
  onToggleDone,
  onEdit,
  onRemove,
}: {
  activity: Activity;
  conflict: boolean;
  onToggleDone: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: a.id,
  });
  const cat = ACTIVITY_CATEGORY[a.category];
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-3 rounded-2xl hover:bg-gray-50 group transition-colors ${
        isDragging ? 'opacity-50 shadow-soft bg-white z-10' : ''
      } ${conflict ? 'bg-red-50/70 hover:bg-red-50' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 w-5 text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
        title="拖拽排序 / 拖到其他天"
      >
        ⠿
      </button>
      <button
        onClick={onToggleDone}
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
          {a.startTime && (
            <span className={conflict ? 'text-red-500 mr-2' : 'text-brand-pink mr-2'}>
              {a.startTime}
              {a.endTime ? `–${a.endTime}` : ''}
            </span>
          )}
          {a.title}
          {conflict && <span className="ml-1.5 text-xs text-red-500">⚠️ 时间冲突</span>}
        </div>
        <div className="text-xs text-gray-400 flex gap-2 flex-wrap">
          <span>{cat.label}</span>
          {a.location && <span>· 📍{a.location}</span>}
          {a.cost > 0 && <span>· {fmtMoney(a.cost)}</span>}
          {a.note && <span>· {a.note}</span>}
        </div>
      </div>
      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button onClick={onEdit} className="text-gray-400 hover:text-brand-blue text-sm px-1">✏️</button>
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 text-sm px-1">🗑️</button>
      </div>
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
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

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

  const openLightbox = (images: string[], index: number) => setLightbox({ images, index });
  const closeLightbox = () => setLightbox(null);
  const stepLightbox = (delta: number) => {
    if (!lightbox) return;
    const len = lightbox.images.length;
    setLightbox({ ...lightbox, index: (lightbox.index + delta + len) % len });
  };

  // 键盘控制：ESC 关闭，左右方向键切换图片
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'ArrowRight') stepLightbox(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox]);

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
              {n.images.length > 0 && (
                <div
                  className={`mt-3 grid gap-1.5 ${
                    n.images.length === 1 ? 'grid-cols-1' : 'grid-cols-3'
                  }`}
                >
                  {n.images.map((src, idx) => (
                    <img
                      key={idx}
                      src={src}
                      alt={`${n.title ?? '记录'}图片 ${idx + 1}`}
                      onClick={() => openLightbox(n.images, idx)}
                      className={`w-full rounded-xl object-cover cursor-zoom-in hover:opacity-90 transition-opacity ${
                        n.images.length === 1 ? 'max-h-72' : 'aspect-square'
                      }`}
                    />
                  ))}
                </div>
              )}
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

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
          >
            ✕
          </button>
          {lightbox.images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); stepLightbox(-1); }}
              className="absolute left-4 sm:left-8 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 text-xl"
            >
              ‹
            </button>
          )}
          <img
            src={lightbox.images[lightbox.index]}
            alt="预览"
            className="max-w-full max-h-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox.images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); stepLightbox(1); }}
              className="absolute right-4 sm:right-8 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 text-xl"
            >
              ›
            </button>
          )}
          {lightbox.images.length > 1 && (
            <div className="absolute bottom-6 text-white/70 text-sm">
              {lightbox.index + 1} / {lightbox.images.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
