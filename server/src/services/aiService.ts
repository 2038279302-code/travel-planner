import axios from 'axios';
import { matchCityPoi } from './poiData';

export interface AiRecommendInput {
  destination: string;
  days: number;
  type: 'travel' | 'business' | 'weekend';
  preferences?: string | null;
  budget?: number | null;
}

export interface AiRegenerateDayInput {
  destination: string;
  type: 'travel' | 'business' | 'weekend';
  day: number;
  totalDays: number;
  /** 调整指令，如"更轻松一点""多安排点美食""换一批" */
  instruction: string;
  /** 同一份行程中其他天的主题+活动标题摘要，避免重新生成后与其他天重复 */
  otherDaysDigest?: string[];
  budget?: number | null;
}

export interface AiDayPlan {
  day: number;
  theme: string;
  items: {
    time: string;
    title: string;
    category: string;
    note: string;
    cost: number;
  }[];
}

export interface AiRecommendResult {
  destination: string;
  summary: string;
  tips: string[];
  days: AiDayPlan[];
  source: 'ai' | 'mock';
  estimatedTotalCost: number;
}

const SYSTEM_PROMPT = `你是一位专业的旅行规划师。请根据用户提供的目的地、天数、出行类型和偏好，生成详细的每日行程规划。
严格只返回 JSON，不要任何额外文字，结构如下：
{
  "summary": "整体行程概述（一句话）",
  "tips": ["实用贴士1", "实用贴士2", "实用贴士3"],
  "days": [
    {
      "day": 1,
      "theme": "当天主题",
      "items": [
        {"time": "09:00", "title": "活动名称", "category": "sightseeing|food|transport|hotel|meeting|other", "note": "简要说明", "cost": 120}
      ]
    }
  ]
}
注意：cost 为该项活动预估花费（人民币元，整数，门票/餐饮/交通/住宿等均需给出合理估算，若确实免费则填 0），需结合目的地真实消费水平与用户预算参考给出贴近实际的数字。`;

/**
 * 调用兼容 OpenAI 的大模型生成行程；未配置 Key 时返回智能 Mock。
 */
export async function generateItinerary(
  input: AiRecommendInput
): Promise<AiRecommendResult> {
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    return buildMockItinerary(input);
  }

  try {
    const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.AI_MODEL || 'gpt-4o-mini';

    const userPrompt = `目的地：${input.destination}
天数：${input.days} 天
出行类型：${{ travel: '休闲旅行', business: '商务差旅', weekend: '周末短途' }[input.type]}
${input.preferences ? `偏好：${input.preferences}` : ''}
${input.budget ? `预算参考：${input.budget} 元` : ''}`;

    const resp = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const content = resp.data?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    const days: AiDayPlan[] = (parsed.days ?? []).map((d: any) => ({
      ...d,
      items: (d.items ?? []).map((it: any) => ({
        ...it,
        cost: Number(it.cost) > 0 ? Number(it.cost) : 0,
      })),
    }));

    return {
      destination: input.destination,
      summary: parsed.summary ?? '',
      tips: parsed.tips ?? [],
      days,
      source: 'ai',
      estimatedTotalCost: sumCost(days),
    };
  } catch (err) {
    console.warn('[AI] 调用失败，回退到 Mock：', (err as Error).message);
    return buildMockItinerary(input);
  }
}

const REGEN_SYSTEM_PROMPT = `你是一位专业的旅行规划师。用户已经有一份多天行程，现在只需要你重新规划其中"某一天"的内容，
使其满足用户提出的调整指令（例如"更轻松一点""多安排点美食""这天全部换一批"等），同时要与行程中其他天的安排不重复、风格连贯。
严格只返回 JSON，不要任何额外文字，结构如下：
{
  "theme": "当天主题",
  "items": [
    {"time": "09:00", "title": "活动名称", "category": "sightseeing|food|transport|hotel|meeting|other", "note": "简要说明", "cost": 120}
  ]
}
注意：cost 为该项活动预估花费（人民币元，整数，需结合目的地真实消费水平给出合理估算，确实免费则填 0）。`;

/**
 * 对行程中的某一天按用户指令重新生成；未配置 Key 时基于指令做规则化调整（仍返回合理结果）。
 */
export async function regenerateDay(input: AiRegenerateDayInput): Promise<AiDayPlan> {
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    return buildMockRegeneratedDay(input);
  }

  try {
    const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.AI_MODEL || 'gpt-4o-mini';

    const userPrompt = `目的地：${input.destination}
出行类型：${{ travel: '休闲旅行', business: '商务差旅', weekend: '周末短途' }[input.type]}
总天数：${input.totalDays} 天，本次要重新规划第 ${input.day} 天
调整指令：${input.instruction}
${input.budget ? `预算参考：${input.budget} 元` : ''}
${
  input.otherDaysDigest && input.otherDaysDigest.length > 0
    ? `行程中其他天已安排（避免重复）：\n${input.otherDaysDigest.join('\n')}`
    : ''
}`;

    const resp = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [
          { role: 'system', content: REGEN_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.9,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const content = resp.data?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    return {
      day: input.day,
      theme: parsed.theme ?? `Day ${input.day}`,
      items: (parsed.items ?? []).map((it: any) => ({
        ...it,
        cost: Number(it.cost) > 0 ? Number(it.cost) : 0,
      })),
    };
  } catch (err) {
    console.warn('[AI] 单天重新生成调用失败，回退到规则调整：', (err as Error).message);
    return buildMockRegeneratedDay(input);
  }
}

/** 无 Key 时的单天重新生成兜底：根据指令关键词做规则化调整，并优先使用 POI 库真实地名 */
function buildMockRegeneratedDay(input: AiRegenerateDayInput): AiDayPlan {
  const { destination, day, instruction } = input;
  const kw = instruction || '';
  const wantsRelax = /轻松|慢|悠闲/.test(kw);
  const wantsFood = /美食|吃|餐/.test(kw);

  const poi = matchCityPoi(destination);
  const relaxPool = poi?.sightseeing.length
    ? poi.sightseeing
    : ['公园漫步', '咖啡馆小憩', '本地市集闲逛', '街区随意散步'];
  const foodPool = poi?.food.length
    ? poi.food
    : ['网红甜品店', '本地人气小吃', '特色主题餐厅', '夜市美食巡礼', '老字号早餐店'];
  const normalPool = poi?.sightseeing.length
    ? poi.sightseeing
    : ['热门景点打卡', '文化古迹参观', '博物馆 / 展览', '观景台拍照'];

  const pool = wantsFood ? foodPool : wantsRelax ? relaxPool : normalPool;
  const times = ['09:30', '12:00', '15:00', '18:30'];
  const items = times.map((time, i) => {
    const isFood = wantsFood || time === '12:00' || time === '18:30';
    return {
      time,
      title: isFood ? foodPool[i % foodPool.length] : pool[i % pool.length],
      category: isFood ? 'food' : 'sightseeing',
      note: `已根据「${instruction}」调整`,
      cost: isFood ? 50 : wantsRelax ? 20 : 60,
    };
  });

  return {
    day,
    theme: wantsRelax
      ? `${destination}悠闲一日`
      : wantsFood
        ? `${destination}美食日`
        : `${destination}焕新安排 Day ${day}`,
    items,
  };
}

/** 汇总所有行程项的预估花费 */
function sumCost(days: AiDayPlan[]): number {
  return days.reduce(
    (total, d) => total + d.items.reduce((s, it) => s + (it.cost || 0), 0),
    0
  );
}

/**
 * 内置智能 Mock：根据天数与类型生成结构合理的示例行程，保证无 Key 也能体验。
 */
function buildMockItinerary(input: AiRecommendInput): AiRecommendResult {
  const { destination, days, type, budget } = input;

  // 优先匹配内置 POI 库，命中则用真实地名，让离线兜底也"懂目的地"而非千篇一律的模板
  const poi = matchCityPoi(destination);
  const sightseeingPool = poi?.sightseeing.length
    ? poi.sightseeing
    : [
        '城市地标打卡',
        '历史文化街区漫步',
        '当地热门博物馆',
        '网红观景台看日落',
        '特色公园散步',
        '老城区文艺小店',
      ];
  const foodPool = poi?.food.length
    ? poi.food
    : [
        '当地人气早餐店',
        '招牌特色午餐',
        '夜市小吃巡礼',
        '高分本地餐厅晚餐',
        '网红咖啡馆下午茶',
      ];

  // 每类活动的基准花费（人民币元），用于估算 cost
  const baseCost: Record<string, number> = {
    sightseeing: 60,
    food: 45,
    transport: 30,
    hotel: 300,
    meeting: 0,
    other: 20,
  };
  // 若用户填了预算参考，按"人均日预算 / 常规日预算"估算一个缩放系数，让费用更贴近用户预期
  const normalDailyBudget = type === 'business' ? 600 : 350;
  const scale = budget && days > 0 ? clamp((budget / days) / normalDailyBudget, 0.5, 3) : 1;
  const estCost = (category: string) => Math.round((baseCost[category] ?? 20) * scale);

  const dayPlans: AiDayPlan[] = [];
  for (let d = 1; d <= days; d++) {
    const isBusiness = type === 'business';
    const items = isBusiness
      ? [
          { time: '08:30', title: '酒店早餐', category: 'food', note: '补充能量，准备一天工作' },
          { time: '09:30', title: '商务会议 / 客户拜访', category: 'meeting', note: '核心行程，提前到场' },
          { time: '12:30', title: '商务午餐', category: 'food', note: '可与同事或客户交流' },
          { time: '14:30', title: '工作 / 考察', category: 'meeting', note: '下午议程' },
          { time: '19:00', title: `${destination}特色晚餐`, category: 'food', note: '忙碌之余犒劳自己' },
        ]
      : [
          {
            time: '09:00',
            title: sightseeingPool[(d - 1) % sightseeingPool.length],
            category: 'sightseeing',
            note: '上午精力充沛，适合主要景点',
          },
          {
            time: '12:00',
            title: foodPool[(d - 1) % foodPool.length],
            category: 'food',
            note: '品尝当地味道',
          },
          {
            time: '14:30',
            title: sightseeingPool[d % sightseeingPool.length],
            category: 'sightseeing',
            note: '下午轻松游览',
          },
          {
            time: '18:30',
            title: foodPool[d % foodPool.length],
            category: 'food',
            note: '享受当地夜生活',
          },
        ];

    dayPlans.push({
      day: d,
      theme:
        d === 1
          ? `初探${destination}`
          : d === days
            ? '收尾与返程'
            : `深度体验 Day ${d}`,
      items: items.map((it) => ({ ...it, cost: estCost(it.category) })),
    });
  }

  const tipsMap = {
    travel: [
      '提前查好天气，按需准备衣物',
      '热门景点建议线上预约门票，避免排队',
      '随身带少量现金，部分小店不支持移动支付',
    ],
    business: [
      '提前确认会议时间地点与交通方案',
      '准备好名片和必要的商务材料',
      '选择交通便利、靠近会场的酒店',
    ],
    weekend: [
      '周末短途，行李从简，轻装出行',
      '避开高峰时段出发，节省路上时间',
      '提前规划停车或公共交通',
    ],
  };

  return {
    destination,
    summary: `为你规划的 ${days} 天${
      { travel: '休闲旅行', business: '商务差旅', weekend: '周末出行' }[type]
    }，覆盖${destination}${poi ? `「${poi.vibe}」` : ''}的精华体验。（当前为离线智能示例，配置 AI Key 后可获得更个性化的推荐）`,
    tips: tipsMap[type],
    days: dayPlans,
    source: 'mock',
    estimatedTotalCost: sumCost(dayPlans),
  };
}

/** 将数值限制在 [min, max] 区间 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
