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
import ConfirmDialog from '../components/ConfirmDialog';
import TripForm from '../components/TripForm';
import ActivityForm from '../components/ActivityForm';
import ExpenseForm from '../components/ExpenseForm';
import NoteForm from '../components/NoteForm';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';
import { createPortal } from 'react-dom';
import type { ApiError } from '../api';
import { PageLoading } from '../components/Skeleton';

/** 从统一错误对象中提取人类可读的提示文案，兜底为通用提示 */
function errMsg(err: unknown, fallback: string): string {
  const apiErr = err as Partial<ApiError> | undefined;
  return apiErr?.message || fallback;
}

type Tab = 'plan' | 'budget' | 'notes';

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useStore();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [tab, setTab] = useState<Tab>('plan');
  const [loading, setLoading] = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);

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

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <PageLoading emoji="🧳" text="正在加载旅行详情…" />
      </div>
    );
  }
  if (!trip) return null;

  const handleUpdate = async (data: Partial<Trip>) => {
    setUpdating(true);
    try {
      await TripApi.update(trip.id, data);
      setShowEdit(false);
      toast('已更新');
      load();
    } catch (err) {
      // 失败时不关闭编辑弹窗，保留用户已填内容，避免误以为保存成功（P0-4）
      toast(errMsg(err, '更新失败，请重试'), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await TripApi.remove(trip.id);
      toast('旅行已删除');
      navigate('/');
    } catch (err) {
      // 失败时保持在当前页、关闭确认弹窗让用户看到错误提示并可重试（P0-4）
      toast(errMsg(err, '删除失败，请重试'), 'error');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
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
          className="h-24 sm:h-40 flex items-center justify-center text-5xl sm:text-7xl relative"
          style={{ background: trip.coverColor }}
        >
          <span className="drop-shadow-lg">{trip.coverEmoji}</span>
        </div>
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 flex-wrap">
                <span>{TRIP_TYPE[trip.type].emoji} {TRIP_TYPE[trip.type].label}</span>
                <span className="chip" style={{ color: st.color, background: st.bg }}>
                  {st.label}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-800 mt-1 break-words">{trip.title}</h1>
              <p className="text-sm sm:text-base text-gray-500 mt-1 flex items-center gap-1 break-words">📍 {trip.destination}</p>
              {trip.description && (
                <p className="text-gray-400 text-xs sm:text-sm mt-2 max-w-xl break-words whitespace-pre-wrap">{trip.description}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button className="btn-icon" onClick={() => setShowEdit(true)} aria-label="编辑旅行">
                ✏️<span className="btn-icon-label ml-1.5">编辑</span>
              </button>
              <button
                className="btn-icon hover:!text-red-500"
                onClick={() => setShowDeleteConfirm(true)}
                aria-label="删除旅行"
              >
                🗑️<span className="btn-icon-label ml-1.5">删除</span>
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

      {/* Tab 切换：三项均分宽度，窄屏下文字更短并把数字收成小圆点角标，
          避免"每日规划 (11)"这类长文案在小屏上挤压变形或撑破容器；
          补充 tablist/tab 无障碍语义，方便屏幕阅读器用户识别（P2-7） */}
      <div className="flex gap-1 sm:gap-2 p-1.5 bg-white/60 rounded-2xl" role="tablist" aria-label="旅行详情分类">
        {([
          { k: 'plan', label: '每日规划', shortLabel: '规划', emoji: '📅', n: trip.activities.length },
          { k: 'budget', label: '预算花销', shortLabel: '花销', emoji: '💸', n: trip.expenses.length },
          { k: 'notes', label: '旅行记录', shortLabel: '记录', emoji: '📝', n: trip.notes.length },
        ] as const).map((t) => (
          <button
            key={t.k}
            id={`tab-${t.k}`}
            role="tab"
            aria-selected={tab === t.k}
            aria-controls={`tabpanel-${t.k}`}
            onClick={() => setTab(t.k)}
            className={`relative flex-1 sm:flex-none px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              tab === t.k
                ? 'bg-gradient-to-r from-brand-pink to-brand-orange text-white shadow-glow'
                : 'text-gray-500 hover:bg-white'
            }`}
          >
            {t.emoji} <span className="sm:hidden">{t.shortLabel}</span>
            <span className="hidden sm:inline">{t.label}</span>
            {t.n > 0 && <span className="ml-1 opacity-70">({t.n})</span>}
          </button>
        ))}
      </div>

      <div id={`tabpanel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'plan' && <PlanTab trip={trip} days={days} reload={load} />}
        {tab === 'budget' && <BudgetTab trip={trip} reload={load} />}
        {tab === 'notes' && <NotesTab trip={trip} reload={load} />}
      </div>

      <Modal open={showEdit} title="✏️ 编辑旅行" onClose={() => !updating && setShowEdit(false)}>
        <TripForm initial={trip} onSubmit={handleUpdate} onCancel={() => setShowEdit(false)} />
      </Modal>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="🗑️ 删除这趟旅行？"
        message={`「${trip.title}」删除后无法恢复，请谨慎操作。`}
        impactList={[
          `${trip.activities.length} 条行程安排`,
          `${trip.expenses.length} 笔花销记录`,
          `${trip.notes.length} 条旅行记录${trip.notes.some((n) => n.images.length > 0) ? '（含图片）' : ''}`,
        ].filter((_, i) => [trip.activities.length, trip.expenses.length, trip.notes.length][i] > 0)}
        confirmLabel="确认删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
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
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState<Activity | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
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
    setSubmitting(true);
    try {
      if (editing) {
        await ActivityApi.update(trip.id, editing.id, data);
        toast('行程已更新');
      } else {
        await ActivityApi.create(trip.id, data);
        toast('行程已添加 🎉');
      }
      setShowForm(false);
      reload();
    } catch (err) {
      // 保留表单打开状态和已填内容，避免用户以为保存成功（P0-4）
      toast(errMsg(err, editing ? '更新失败，请重试' : '添加失败，请重试'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDone = async (a: Activity) => {
    try {
      await ActivityApi.update(trip.id, a.id, { done: !a.done });
      reload();
    } catch (err) {
      toast(errMsg(err, '操作失败，请重试'), 'error');
    }
  };

  const remove = async (a: Activity) => {
    setRemoveLoading(true);
    try {
      await ActivityApi.remove(trip.id, a.id);
      toast('已删除');
      setRemoving(null);
      reload();
    } catch (err) {
      toast(errMsg(err, '删除失败，请重试'), 'error');
    } finally {
      setRemoveLoading(false);
    }
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
            <div className="card p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-brand-pink to-brand-orange text-white flex items-center justify-center font-bold text-xs sm:text-sm">
                    D{idx + 1}
                  </span>
                  <div>
                    <div className="font-bold text-gray-800 text-sm sm:text-base">第 {idx + 1} 天</div>
                    <div className="text-xs text-gray-400">{fmtMonthDay(day)}</div>
                  </div>
                </div>
                <button
                  onClick={() => openAdd(day)}
                  className="shrink-0 text-sm text-brand-pink hover:underline"
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
                        onRemove={() => setRemoving(a)}
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

      <ConfirmDialog
        open={!!removing}
        title="🗑️ 删除这个行程项？"
        message={removing ? `「${removing.title}」删除后无法恢复。` : ''}
        confirmLabel="确认删除"
        loading={removeLoading}
        onConfirm={() => removing && remove(removing)}
        onCancel={() => setRemoving(null)}
      />
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
      className={`flex items-start gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-2xl hover:bg-gray-50 group transition-colors ${
        isDragging ? 'opacity-50 shadow-soft bg-white z-10' : ''
      } ${conflict ? 'bg-red-50/70 hover:bg-red-50' : ''}`}
    >
      {/* 拖拽手柄 + 勾选框：移动端收窄尺寸，减少对标题可用宽度的挤压 */}
      <button
        {...attributes}
        {...listeners}
        aria-label="拖拽排序 / 拖到其他天"
        title="拖拽排序 / 拖到其他天"
        className="shrink-0 w-5 sm:w-8 h-8 -ml-1 sm:-ml-1.5 flex items-center justify-center text-base sm:text-lg text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none mt-0.5"
      >
        ⠿
      </button>
      <button
        onClick={onToggleDone}
        aria-label={a.done ? '标记为未完成' : '标记为已完成'}
        className={`shrink-0 w-5 h-5 sm:w-6 sm:h-6 mt-1 rounded-full border-2 flex items-center justify-center text-xs transition-colors ${
          a.done
            ? 'bg-brand-green border-brand-green text-white'
            : 'border-gray-300 text-transparent hover:border-brand-pink'
        }`}
      >
        ✓
      </button>
      <span
        className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-base sm:text-lg"
        style={{ background: cat.color + '22' }}
      >
        {cat.emoji}
      </span>
      {/* 文字区：标题允许换行完整展示，不再单行截断成"北..."这种半截文案；
          时间戳独占一行放在标题上方，避免和标题在窄屏上抢宽度 */}
      <div className="flex-1 min-w-0 pt-0.5">
        {a.startTime && (
          <div className={`text-xs font-semibold mb-0.5 ${conflict ? 'text-red-500' : 'text-brand-pink'}`}>
            {a.startTime}
            {a.endTime ? `–${a.endTime}` : ''}
            {conflict && <span className="ml-1.5 text-red-500">⚠️ 时间冲突</span>}
          </div>
        )}
        <div className={`font-medium break-words ${a.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {a.title}
          {conflict && !a.startTime && <span className="ml-1.5 text-xs text-red-500">⚠️ 时间冲突</span>}
        </div>
        <div className="text-xs text-gray-400 flex gap-2 flex-wrap mt-0.5">
          <span>{cat.label}</span>
          {a.location && <span>· 📍{a.location}</span>}
          {a.cost > 0 && <span>· {fmtMoney(a.cost)}</span>}
          {a.note && <span>· {a.note}</span>}
        </div>
      </div>
      <div className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity flex gap-0.5 sm:gap-1">
        <button onClick={onEdit} aria-label="编辑行程" className="text-gray-400 hover:text-brand-blue text-sm p-1.5 sm:px-1 sm:py-0">✏️</button>
        <button onClick={onRemove} aria-label="删除行程" className="text-gray-400 hover:text-red-500 text-sm p-1.5 sm:px-1 sm:py-0">🗑️</button>
      </div>
    </div>
  );
}

type ExpenseSortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

const EXPENSE_SORT_OPTIONS: { key: ExpenseSortKey; label: string }[] = [
  { key: 'date-desc', label: '按日期，最新优先' },
  { key: 'date-asc', label: '按日期，最早优先' },
  { key: 'amount-desc', label: '按金额，从高到低' },
  { key: 'amount-asc', label: '按金额，从低到高' },
];

/* ============ 预算花销 Tab ============ */
function BudgetTab({ trip, reload }: { trip: TripDetail; reload: () => void }) {
  const { toast } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState<Expense | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  // 分类筛选 + 排序（P1-8）
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<ExpenseSortKey>('date-desc');

  const total = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const pct = trip.budget > 0 ? Math.min(100, (total / trip.budget) * 100) : 0;
  const over = trip.budget > 0 && total > trip.budget;

  const visibleExpenses = (() => {
    let list =
      categoryFilter === 'all'
        ? trip.expenses
        : trip.expenses.filter((e) => e.category === categoryFilter);
    const [field, order] = sortKey.split('-') as ['date' | 'amount', 'asc' | 'desc'];
    list = [...list].sort((a, b) => {
      const av = field === 'amount' ? a.amount : new Date(a.date).getTime();
      const bv = field === 'amount' ? b.amount : new Date(b.date).getTime();
      return order === 'asc' ? av - bv : bv - av;
    });
    return list;
  })();

  // 分类汇总
  const byCat = trip.expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  const handleSubmit = async (data: Partial<Expense>) => {
    setSubmitting(true);
    try {
      if (editing) {
        await ExpenseApi.update(trip.id, editing.id, data);
        toast('已更新');
      } else {
        await ExpenseApi.create(trip.id, data);
        toast('花销已记录 💸');
      }
      setShowForm(false);
      reload();
    } catch (err) {
      toast(errMsg(err, editing ? '更新失败，请重试' : '添加失败，请重试'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (e: Expense) => {
    setRemoveLoading(true);
    try {
      await ExpenseApi.remove(trip.id, e.id);
      toast('已删除');
      setRemoving(null);
      reload();
    } catch (err) {
      toast(errMsg(err, '删除失败，请重试'), 'error');
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* 预算概览 */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-end justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-gray-400">已花费</div>
            <div className={`text-2xl sm:text-3xl font-extrabold truncate ${over ? 'text-red-500' : 'text-gray-800'}`}>
              {fmtMoney(total)}
            </div>
          </div>
          <div className="text-right text-xs sm:text-sm text-gray-400 shrink-0">
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

      <div className="flex justify-between items-center flex-wrap gap-3">
        <h3 className="font-bold text-gray-700">花销明细</h3>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          ＋ 记一笔
        </button>
      </div>

      {/* 分类筛选 + 排序（P1-8），仅在有花销记录时展示 */}
      {trip.expenses.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="input w-auto text-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="按分类筛选"
          >
            <option value="all">全部分类</option>
            {Object.entries(EXPENSE_CATEGORY).map(([k, v]) => (
              <option key={k} value={k}>
                {v.emoji} {v.label}
              </option>
            ))}
          </select>
          <select
            className="input w-auto text-sm"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as ExpenseSortKey)}
            aria-label="排序方式"
          >
            {EXPENSE_SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {trip.expenses.length === 0 ? (
        <div className="card p-10 text-center text-gray-300">还没有花销记录～</div>
      ) : visibleExpenses.length === 0 ? (
        <div className="card p-10 text-center text-gray-300">该分类下没有花销记录</div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {visibleExpenses.map((e) => {
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
                <div className="font-bold text-gray-700 shrink-0">{fmtMoney(e.amount)}</div>
                <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity flex gap-1 shrink-0">
                  <button onClick={() => { setEditing(e); setShowForm(true); }} aria-label="编辑花销" className="text-gray-400 hover:text-brand-blue text-base sm:text-sm p-1.5 sm:p-1">✏️</button>
                  <button onClick={() => setRemoving(e)} aria-label="删除花销" className="text-gray-400 hover:text-red-500 text-base sm:text-sm p-1.5 sm:p-1">🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showForm}
        title={editing ? '✏️ 编辑花销' : '💸 记一笔'}
        onClose={() => !submitting && setShowForm(false)}
      >
        <ExpenseForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
        />
      </Modal>

      <ConfirmDialog
        open={!!removing}
        title="🗑️ 删除这条花销？"
        message={removing ? `「${removing.title}」（${fmtMoney(removing.amount)}）删除后无法恢复。` : ''}
        confirmLabel="确认删除"
        loading={removeLoading}
        onConfirm={() => removing && remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

/* ============ 旅行记录 Tab ============ */
function NotesTab({ trip, reload }: { trip: TripDetail; reload: () => void }) {
  const { toast } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState<Note | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  // 搜索 + 心情筛选 + 日期排序（P1-8）
  const [keyword, setKeyword] = useState('');
  const [moodFilter, setMoodFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const availableMoods = Array.from(new Set(trip.notes.map((n) => n.mood)));

  const visibleNotes = (() => {
    let list = trip.notes;
    const kw = keyword.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (n) =>
          n.content.toLowerCase().includes(kw) || (n.title ?? '').toLowerCase().includes(kw)
      );
    }
    if (moodFilter !== 'all') {
      list = list.filter((n) => n.mood === moodFilter);
    }
    return [...list].sort((a, b) => {
      const av = new Date(a.date).getTime();
      const bv = new Date(b.date).getTime();
      return sortOrder === 'asc' ? av - bv : bv - av;
    });
  })();

  const handleSubmit = async (data: Partial<Note>) => {
    setSubmitting(true);
    try {
      if (editing) {
        await NoteApi.update(trip.id, editing.id, data);
        toast('记录已更新');
      } else {
        await NoteApi.create(trip.id, data);
        toast('记录已保存 📝');
      }
      setShowForm(false);
      reload();
    } catch (err) {
      toast(errMsg(err, editing ? '更新失败，请重试' : '保存失败，请重试'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (n: Note) => {
    setRemoveLoading(true);
    try {
      await NoteApi.remove(trip.id, n.id);
      toast('已删除');
      setRemoving(null);
      reload();
    } catch (err) {
      toast(errMsg(err, '删除失败，请重试'), 'error');
    } finally {
      setRemoveLoading(false);
    }
  };

  const openLightbox = (images: string[], index: number) => setLightbox({ images, index });
  const closeLightbox = () => setLightbox(null);
  const stepLightbox = (delta: number) => {
    if (!lightbox) return;
    const len = lightbox.images.length;
    setLightbox({ ...lightbox, index: (lightbox.index + delta + len) % len });
  };

  // Lightbox 打开时锁定背后页面滚动，避免移动端出现滚动穿透
  useLockBodyScroll(!!lightbox);

  // 键盘控制：ESC 关闭，左右方向键切换图片。用捕获阶段监听并阻止冒泡，
  // 避免同一次 ESC 被外层 Modal 的监听器同时捕获、导致表单也被一并关闭
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeLightbox();
      } else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'ArrowRight') stepLightbox(1);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [lightbox]);

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex justify-between items-center flex-wrap gap-3">
        {/* 搜索 + 心情筛选 + 日期排序（P1-8），仅在有记录时展示 */}
        {trip.notes.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <div className="relative min-w-[160px]">
              <input
                type="search"
                className="input pl-9 text-sm"
                placeholder="搜索记录内容…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                aria-label="搜索旅行记录"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            </div>
            {availableMoods.length > 1 && (
              <select
                className="input w-auto text-sm"
                value={moodFilter}
                onChange={(e) => setMoodFilter(e.target.value)}
                aria-label="按心情筛选"
              >
                <option value="all">全部心情</option>
                {availableMoods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            <select
              className="input w-auto text-sm"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
              aria-label="排序方式"
            >
              <option value="desc">最新优先</option>
              <option value="asc">最早优先</option>
            </select>
          </div>
        ) : (
          <div />
        )}
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          ＋ 写记录
        </button>
      </div>

      {trip.notes.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl animate-float">📖</div>
          <p className="text-gray-400 mt-3">还没有旅行记录，写下第一篇手账吧～</p>
        </div>
      ) : visibleNotes.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl">🔍</div>
          <p className="text-gray-400 mt-3">没有找到匹配的记录</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 gap-5 space-y-5">
          {visibleNotes.map((n) => (
            <div key={n.id} className="card p-4 sm:p-5 break-inside-avoid group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl shrink-0">{n.mood}</span>
                  <div className="min-w-0">
                    {n.title && <div className="font-bold text-gray-800 truncate">{n.title}</div>}
                    <div className="text-xs text-gray-400">{fmtDate(n.date)}</div>
                  </div>
                </div>
                <div className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => { setEditing(n); setShowForm(true); }} aria-label="编辑记录" className="text-gray-400 hover:text-brand-blue text-base sm:text-sm p-1.5 sm:p-1">✏️</button>
                  <button onClick={() => setRemoving(n)} aria-label="删除记录" className="text-gray-400 hover:text-red-500 text-base sm:text-sm p-1.5 sm:p-1">🗑️</button>
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
                    <button
                      key={idx}
                      type="button"
                      onClick={() => openLightbox(n.images, idx)}
                      aria-label={`查看${n.title ?? '记录'}图片 ${idx + 1}`}
                      className={`p-0 border-0 bg-transparent block w-full rounded-xl overflow-hidden focus-visible:ring-2 focus-visible:ring-brand-pink/50 ${
                        n.images.length === 1 ? '' : 'aspect-square'
                      }`}
                    >
                      <img
                        src={src}
                        alt={`${n.title ?? '记录'}图片 ${idx + 1}`}
                        className={`w-full h-full rounded-xl object-cover cursor-zoom-in hover:opacity-90 transition-opacity ${
                          n.images.length === 1 ? 'max-h-72' : ''
                        }`}
                      />
                    </button>
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
        onClose={() => !submitting && setShowForm(false)}
      >
        <NoteForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
        />
      </Modal>

      <ConfirmDialog
        open={!!removing}
        title="🗑️ 删除这条记录？"
        message={removing ? `「${removing.title || '记录'}」删除后无法恢复。${removing.images.length > 0 ? '（含图片）' : ''}` : ''}
        confirmLabel="确认删除"
        loading={removeLoading}
        onConfirm={() => removing && remove(removing)}
        onCancel={() => setRemoving(null)}
      />

      {lightbox &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="图片预览"
            className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80"
            onClick={closeLightbox}
          >
            <button
              onClick={closeLightbox}
              aria-label="关闭预览"
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            >
              ✕
            </button>
            {lightbox.images.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); stepLightbox(-1); }}
                aria-label="上一张"
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
                aria-label="下一张"
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
          </div>,
          document.body
        )}
    </div>
  );
}
