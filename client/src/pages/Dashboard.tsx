import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { TripApi } from '../api';
import type { Trip, TripType } from '../types';
import { TRIP_TYPE, TRIP_STATUS } from '../utils/constants';
import { fmtMonthDay, tripDays, fmtMoney } from '../utils/format';
import Modal from '../components/Modal';
import TripForm from '../components/TripForm';

const FILTERS: { key: 'all' | TripType; label: string; emoji: string }[] = [
  { key: 'all', label: '全部', emoji: '🌈' },
  { key: 'travel', label: '旅行', emoji: '🌴' },
  { key: 'business', label: '差旅', emoji: '💼' },
  { key: 'weekend', label: '周末', emoji: '🎒' },
];

export default function Dashboard() {
  const { trips, stats, loading, refresh, toast } = useStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | TripType>('all');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? trips : trips.filter((t) => t.type === filter)),
    [trips, filter]
  );

  const handleCreate = async (data: Partial<Trip>) => {
    try {
      await TripApi.create(data);
      setShowCreate(false);
      toast('旅行创建成功，开始规划吧！🎉');
      refresh();
    } catch {
      toast('创建失败，请重试', 'error');
    }
  };

  return (
    <div className="space-y-7">
      {/* 欢迎语 + 统计 */}
      <section className="animate-fade-up">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800">
          你好呀，旅行家 👋
        </h1>
        <p className="text-gray-500 mt-1">记录每一段说走就走的旅程</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <StatCard emoji="🧳" label="旅行总数" value={stats?.totalTrips ?? 0} grad="from-brand-pink to-brand-orange" />
          <StatCard emoji="📍" label="去过城市" value={stats?.destinationCount ?? 0} grad="from-brand-blue to-cyan-400" />
          <StatCard emoji="💸" label="累计花费" value={fmtMoney(stats?.totalSpent ?? 0)} grad="from-brand-purple to-indigo-400" />
          <StatCard emoji="✅" label="已完成" value={stats?.completed ?? 0} grad="from-brand-green to-emerald-400" />
        </div>
      </section>

      {/* 筛选 + 新建 */}
      <section className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="行程类型筛选">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`chip px-4 py-2 ${
                filter === f.key
                  ? 'bg-gradient-to-r from-brand-pink to-brand-orange text-white shadow-glow'
                  : 'bg-white/70 text-gray-500 hover:bg-white'
              }`}
            >
              {f.emoji} {f.label}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          ＋ 新建旅行
        </button>
      </section>

      {/* 卡片墙 */}
      {loading && trips.length === 0 ? (
        <div className="text-center text-gray-400 py-20">加载中…</div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setShowCreate(true)} />
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((trip, i) => (
            <TripCard
              key={trip.id}
              trip={trip}
              delay={i * 60}
              onClick={() => navigate(`/trips/${trip.id}`)}
            />
          ))}
        </section>
      )}

      <Modal open={showCreate} title="✨ 新建旅行" onClose={() => setShowCreate(false)}>
        <TripForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
      </Modal>
    </div>
  );
}

function StatCard({
  emoji,
  label,
  value,
  grad,
}: {
  emoji: string;
  label: string;
  value: string | number;
  grad: string;
}) {
  return (
    <div className={`rounded-3xl p-4 text-white shadow-soft bg-gradient-to-br ${grad}`}>
      <div className="text-2xl">{emoji}</div>
      <div className="text-2xl font-extrabold mt-1.5">{value}</div>
      <div className="text-xs opacity-90 mt-0.5">{label}</div>
    </div>
  );
}

function TripCard({
  trip,
  onClick,
  delay,
}: {
  trip: Trip;
  onClick: () => void;
  delay: number;
}) {
  const st = TRIP_STATUS[trip.status];
  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`查看旅行：${trip.title}`}
      className="card overflow-hidden cursor-pointer group animate-fade-up hover:-translate-y-1 transition-transform focus-visible:-translate-y-1"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="h-28 flex items-center justify-center text-6xl relative"
        style={{ background: trip.coverColor }}
      >
        <span className="group-hover:scale-110 transition-transform drop-shadow">
          {trip.coverEmoji}
        </span>
        <span
          className="chip absolute top-3 right-3 bg-white/90"
          style={{ color: st.color }}
        >
          {st.label}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {TRIP_TYPE[trip.type].emoji} {TRIP_TYPE[trip.type].label}
          </span>
        </div>
        <h3 className="font-bold text-lg text-gray-800 mt-0.5 truncate">{trip.title}</h3>
        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1 truncate">
          📍 {trip.destination}
        </p>
        <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
          <span>
            🗓️ {fmtMonthDay(trip.startDate)} · {tripDays(trip.startDate, trip.endDate)}天
          </span>
          <span>💰 {fmtMoney(trip.budget)}</span>
        </div>
        {trip._count && (
          <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <span>📅 {trip._count.activities} 行程</span>
            <span>💸 {trip._count.expenses} 花销</span>
            <span>📝 {trip._count.notes} 记录</span>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card py-16 flex flex-col items-center text-center animate-fade-up">
      <div className="text-6xl animate-float">🏝️</div>
      <h3 className="text-lg font-bold text-gray-700 mt-4">还没有旅行计划</h3>
      <p className="text-gray-400 mt-1">创建你的第一段旅程，开启精彩冒险！</p>
      <button className="btn-primary mt-5" onClick={onCreate}>
        ＋ 新建旅行
      </button>
    </div>
  );
}
