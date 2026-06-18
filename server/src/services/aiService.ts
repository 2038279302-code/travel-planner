import axios from 'axios';

export interface AiRecommendInput {
  destination: string;
  days: number;
  type: 'travel' | 'business' | 'weekend';
  preferences?: string | null;
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
  }[];
}

export interface AiRecommendResult {
  destination: string;
  summary: string;
  tips: string[];
  days: AiDayPlan[];
  source: 'ai' | 'mock';
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
        {"time": "09:00", "title": "活动名称", "category": "sightseeing|food|transport|hotel|meeting|other", "note": "简要说明"}
      ]
    }
  ]
}`;

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

    return {
      destination: input.destination,
      summary: parsed.summary ?? '',
      tips: parsed.tips ?? [],
      days: parsed.days ?? [],
      source: 'ai',
    };
  } catch (err) {
    console.warn('[AI] 调用失败，回退到 Mock：', (err as Error).message);
    return buildMockItinerary(input);
  }
}

/**
 * 内置智能 Mock：根据天数与类型生成结构合理的示例行程，保证无 Key 也能体验。
 */
function buildMockItinerary(input: AiRecommendInput): AiRecommendResult {
  const { destination, days, type } = input;

  const sightseeingPool = [
    '城市地标打卡',
    '历史文化街区漫步',
    '当地热门博物馆',
    '网红观景台看日落',
    '特色公园散步',
    '老城区文艺小店',
  ];
  const foodPool = [
    '当地人气早餐店',
    '招牌特色午餐',
    '夜市小吃巡礼',
    '高分本地餐厅晚餐',
    '网红咖啡馆下午茶',
  ];

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
      items,
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
    }，覆盖${destination}的精华体验。（当前为离线智能示例，配置 AI Key 后可获得更个性化的推荐）`,
    tips: tipsMap[type],
    days: dayPlans,
    source: 'mock',
  };
}
