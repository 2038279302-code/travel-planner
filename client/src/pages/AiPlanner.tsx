import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AiRecommendResult, TripType, ActivityCategory } from '../types';
import { AiApi, TripApi, ActivityApi } from '../api';
import { useStore } from '../store/useStore';
import { TRIP_TYPE, ACTIVITY_CATEGORY, COVER_EMOJIS, COVER_COLORS } from '../utils/constants';
import { fmtMoney } from '../utils/format';
import FieldError from '../components/FieldError';

// 局部重新生成的预设调整指令
const REGEN_PRESETS = [
  { label: '🔄 换一换', instruction: '这天全部换一批不一样的安排' },
  { label: '🍃 更轻松', instruction: '这天的安排更轻松、慢节奏一点，少走一些路' },
  { label: '🍜 多点美食', instruction: '这天多安排一些当地美食体验' },
];

export default function AiPlanner() {
  const navigate = useNavigate();
  const { toast } = useStore();
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState(3);
  const [type, setType] = useState<TripType>('travel');
  const [preferences, setPreferences] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AiRecommendResult | null>(null);
  // 正在重新生成的天数（用于按钮 loading 态），null 表示当前没有在重新生成
  const [regenDay, setRegenDay] = useState<number | null>(null);
  // 每天自定义调整指令的输入框内容
  const [customInstruction, setCustomInstruction] = useState<Record<number, string>>({});
  const [destinationError, setDestinationError] = useState<string | undefined>();
  const destinationRef = useRef<HTMLInputElement>(null);

  const generate = async () => {
    if (!destination.trim()) {
      setDestinationError('请先填写目的地哦');
      toast('请先填写目的地哦', 'error');
      destinationRef.current?.focus();
      return;
    }
    setDestinationError(undefined);
    setLoading(true);
    setResult(null);
    try {
      const res = await AiApi.recommend({
        destination: destination.trim(),
        days,
        type,
        preferences: preferences.trim() || undefined,
        budget: budget ? Number(budget) : undefined,
      });
      setResult(res);
    } catch {
      toast('生成失败，请稍后再试', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 一键把 AI 结果保存为正式旅行
  const saveAsTrip = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + result.days.length - 1);

      const trip = await TripApi.create({
        title: `${result.destination}${TRIP_TYPE[type].label}`,
        type,
        destination: result.destination,
        description: result.summary,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        // 用户未填预算参考时，用 AI 预估总花费兜底，避免预算页出现"0 预算"的失真状态
        budget: budget ? Number(budget) : result.estimatedTotalCost,
        status: 'planning',
        coverColor: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
        coverEmoji: COVER_EMOJIS[Math.floor(Math.random() * COVER_EMOJIS.length)],
      });

      // 写入每个行程项
      for (const d of result.days) {
        const dayDate = new Date(start);
        dayDate.setDate(dayDate.getDate() + (d.day - 1));
        for (let i = 0; i < d.items.length; i++) {
          const item = d.items[i];
          const cat = ((ACTIVITY_CATEGORY as any)[item.category]
            ? item.category
            : 'other') as ActivityCategory;
          await ActivityApi.create(trip.id, {
            dayDate: dayDate.toISOString(),
            startTime: item.time,
            title: item.title,
            category: cat,
            note: item.note,
            cost: item.cost || 0,
            order: i,
          });
        }
      }
      toast('已保存为旅行，去看看吧！🎉');
      navigate(`/trips/${trip.id}`);
    } catch {
      toast('保存失败，请重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 局部重新生成某一天：instruction 为"换一换/更轻松/多点美食"或自定义指令
  const regenerate = async (dayNum: number, instruction: string) => {
    if (!result || !instruction.trim()) return;
    setRegenDay(dayNum);
    try {
      const otherDaysDigest = result.days
        .filter((d) => d.day !== dayNum)
        .map((d) => `Day${d.day} ${d.theme}：${d.items.map((it) => it.title).join('、')}`);

      const newDay = await AiApi.regenerateDay({
        destination: result.destination,
        type,
        day: dayNum,
        totalDays: result.days.length,
        instruction: instruction.trim(),
        otherDaysDigest,
        budget: budget ? Number(budget) : undefined,
      });

      setResult((prev) => {
        if (!prev) return prev;
        const newDays = prev.days.map((d) => (d.day === dayNum ? newDay : d));
        return {
          ...prev,
          days: newDays,
          estimatedTotalCost: newDays.reduce(
            (total, d) => total + d.items.reduce((s, it) => s + (it.cost || 0), 0),
            0
          ),
        };
      });
      toast(`Day ${dayNum} 已重新安排 ✨`);
    } catch {
      toast('重新生成失败，请稍后再试', 'error');
    } finally {
      setRegenDay(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800">
          🤖 AI 行程规划
        </h1>
        <p className="text-gray-500 mt-1">告诉我去哪、玩几天，帮你生成专属行程</p>
      </header>

      {/* 输入表单 */}
      <div className="card p-6 animate-fade-up space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ai-destination" className="text-sm text-gray-500 mb-1 block">目的地 *</label>
            <input
              id="ai-destination"
              ref={destinationRef}
              className={`input ${destinationError ? 'input-error' : ''}`}
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                if (destinationError) setDestinationError(undefined);
              }}
              placeholder="例如：成都、东京、大理"
              aria-invalid={!!destinationError}
              aria-describedby={destinationError ? 'ai-destination-error' : undefined}
            />
            <FieldError id="ai-destination-error" message={destinationError} />
          </div>
          <div>
            <label htmlFor="ai-days" className="text-sm text-gray-500 mb-1 block">天数</label>
            <input
              id="ai-days"
              type="number"
              min={1}
              max={30}
              className="input"
              value={days}
              onChange={(e) => setDays(Math.max(1, Math.min(30, Number(e.target.value))))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500 mb-1.5 block">出行类型</label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="出行类型">
              {Object.entries(TRIP_TYPE).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={type === k}
                  onClick={() => setType(k as TripType)}
                  className={`chip px-4 py-2 ${
                    type === k
                      ? 'bg-gradient-to-r from-brand-pink to-brand-orange text-white shadow-glow'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {v.emoji} {v.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="ai-budget" className="text-sm text-gray-500 mb-1 block">预算参考（¥，选填）</label>
            <input
              id="ai-budget"
              type="number"
              min={0}
              className="input"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="例如：5000"
            />
          </div>
        </div>

        <div>
          <label htmlFor="ai-preferences" className="text-sm text-gray-500 mb-1 block">偏好（选填）</label>
          <input
            id="ai-preferences"
            className="input"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder="例如：喜欢美食、博物馆、不想太累、带小孩"
          />
        </div>

        <button className="btn-primary w-full" onClick={generate} disabled={loading}>
          {loading ? '✨ 正在为你规划…' : '✨ 生成行程'}
        </button>
      </div>

      {/* 加载占位 */}
      {loading && (
        <div className="card p-10 text-center animate-fade-up">
          <div className="text-5xl animate-float">🧭</div>
          <p className="text-gray-400 mt-3">AI 正在认真思考你的专属路线…</p>
        </div>
      )}

      {/* 结果 */}
      {result && !loading && (
        <div className="space-y-5 animate-fade-up">
          <div className="card p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-bold text-gray-800 break-words min-w-0">
                ✈️ {result.destination} · {result.days.length} 天行程
              </h2>
              <div className="flex items-center gap-2">
                <span className="chip bg-gray-100 text-gray-400 text-xs">
                  {result.source === 'ai' ? '🤖 AI 生成' : '📦 离线示例'}
                </span>
                <button className="btn-primary" onClick={saveAsTrip} disabled={saving}>
                  {saving ? '保存中…' : '📌 保存为旅行'}
                </button>
              </div>
            </div>
            <p className="text-gray-500 mt-2">{result.summary}</p>
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="chip bg-brand-pink/10 text-brand-pink font-semibold">
                💰 预估总花费 {fmtMoney(result.estimatedTotalCost)}
              </span>
              {!!budget && (
                <span className="text-xs text-gray-400">
                  （你的预算参考：{fmtMoney(Number(budget))}）
                </span>
              )}
            </div>
            {result.tips.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {result.tips.map((t, i) => (
                  <span key={i} className="chip bg-yellow-50 text-yellow-700">💡 {t}</span>
                ))}
              </div>
            )}
          </div>

          {result.days.map((d) => {
            const dayCost = d.items.reduce((s, it) => s + (it.cost || 0), 0);
            return (
              <div key={d.day} className="card p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-purple to-brand-blue text-white flex items-center justify-center font-bold text-sm">
                      D{d.day}
                    </span>
                    <h3 className="font-bold text-gray-800 truncate">{d.theme}</h3>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-gray-400">当日约 {fmtMoney(dayCost)}</span>
                </div>

                {/* 局部重新生成操作栏 */}
                <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-gray-100">
                  {REGEN_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      className="chip bg-gray-100 text-gray-500 text-xs hover:bg-gray-200 disabled:opacity-50"
                      disabled={regenDay !== null}
                      onClick={() => regenerate(d.day, preset.instruction)}
                    >
                      {regenDay === d.day ? '✨ 生成中…' : preset.label}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
                    <input
                      className="input text-xs py-1.5 flex-1"
                      placeholder="或输入自定义调整，如：换成室内活动"
                      value={customInstruction[d.day] ?? ''}
                      onChange={(e) =>
                        setCustomInstruction((prev) => ({ ...prev, [d.day]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') regenerate(d.day, customInstruction[d.day] ?? '');
                      }}
                      disabled={regenDay !== null}
                    />
                    <button
                      className="chip bg-brand-purple/10 text-brand-purple text-xs shrink-0 disabled:opacity-50"
                      disabled={regenDay !== null || !(customInstruction[d.day] ?? '').trim()}
                      onClick={() => regenerate(d.day, customInstruction[d.day] ?? '')}
                    >
                      应用
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {d.items.map((item, i) => {
                    const cat = (ACTIVITY_CATEGORY as any)[item.category] ?? ACTIVITY_CATEGORY.other;
                    return (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-gray-50">
                        <span className="text-sm font-mono text-brand-pink w-12 shrink-0">{item.time}</span>
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: cat.color + '22' }}
                        >
                          {cat.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-800">{item.title}</div>
                          <div className="text-xs text-gray-400">{item.note}</div>
                        </div>
                        {!!item.cost && (
                          <span className="text-xs font-semibold text-gray-500 shrink-0">
                            {fmtMoney(item.cost)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
