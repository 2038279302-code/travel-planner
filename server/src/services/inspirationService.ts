import axios from 'axios';

export interface InspirationCard {
  id: string;
  title: string;
  cover: string; // 渐变色或图片地址
  coverEmoji: string;
  destination: string;
  tags: string[];
  author: string;
  likes: number;
  excerpt: string;
}

const GRADIENTS = [
  'linear-gradient(135deg, #FF6B9D 0%, #FFA07A 100%)',
  'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
  'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)',
  'linear-gradient(135deg, #FA709A 0%, #FEE140 100%)',
  'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)',
  'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)',
  'linear-gradient(135deg, #A18CD1 0%, #FBC2EB 100%)',
  'linear-gradient(135deg, #FFD26F 0%, #FF6FB5 100%)',
];

const MOCK_DATA: Omit<InspirationCard, 'id' | 'cover'>[] = [
  {
    title: '京都赏枫攻略｜3天2夜完美路线',
    coverEmoji: '🍁',
    destination: '日本·京都',
    tags: ['赏枫', '古寺', '和服体验'],
    author: '旅行的喵',
    likes: 12800,
    excerpt: '清水寺、岚山、伏见稻荷，秋天的京都美到窒息，附超详细交通和拍照机位～',
  },
  {
    title: '大理洱海环湖｜周末两天放空之旅',
    coverEmoji: '🏔️',
    destination: '中国·大理',
    tags: ['洱海', '骑行', '发呆'],
    author: '风的方向',
    likes: 8600,
    excerpt: '租辆小电驴环洱海，找家海景咖啡馆坐一下午，治愈一整周的疲惫。',
  },
  {
    title: '曼谷美食地图｜吃货必收藏',
    coverEmoji: '🍜',
    destination: '泰国·曼谷',
    tags: ['美食', '夜市', '人均100'],
    author: '吃遍东南亚',
    likes: 23400,
    excerpt: '从街边船面到米其林餐厅，10家本地人都爱去的宝藏小店全公开！',
  },
  {
    title: '上海city walk｜小众文艺路线',
    coverEmoji: '🏙️',
    destination: '中国·上海',
    tags: ['CityWalk', '咖啡', '老洋房'],
    author: '城市漫游者',
    likes: 6700,
    excerpt: '武康路-安福路-五原路，一条线串起最有腔调的上海，咖啡续命专用。',
  },
  {
    title: '富士山下｜河口湖一日游全记录',
    coverEmoji: '🗻',
    destination: '日本·山梨',
    tags: ['富士山', '温泉', '摄影'],
    author: '追光少年',
    likes: 15200,
    excerpt: '逆富士、樱花、温泉一次满足，分享最佳拍摄时间和机位坐标。',
  },
  {
    title: '成都安逸之旅｜火锅+熊猫+茶馆',
    coverEmoji: '🐼',
    destination: '中国·成都',
    tags: ['火锅', '熊猫', '慢生活'],
    author: '巴适得很',
    likes: 19800,
    excerpt: '看完熊猫吃火锅，再去人民公园喝盖碗茶掏耳朵，巴适得板！',
  },
  {
    title: '巴厘岛蜜月｜海岛度假指南',
    coverEmoji: '🏝️',
    destination: '印尼·巴厘岛',
    tags: ['海岛', '度假', '泳池别墅'],
    author: '海岛控',
    likes: 31000,
    excerpt: '私人泳池别墅、网红秋千、悬崖海景餐厅，蜜月就该这么浪漫～',
  },
  {
    title: '西安三天两夜｜穿越千年古都',
    coverEmoji: '🏯',
    destination: '中国·西安',
    tags: ['历史', '兵马俑', '美食'],
    author: '长安归来',
    likes: 9400,
    excerpt: '兵马俑、大唐不夜城、回民街，白天看历史晚上嗦面，超满足！',
  },
];

/**
 * 获取旅行灵感卡片。
 * 若配置了 XHS_API_BASE 则尝试调用真实数据源，否则返回内置 Mock。
 */
export async function getInspirations(keyword?: string): Promise<{
  source: 'api' | 'mock';
  cards: InspirationCard[];
}> {
  const apiBase = process.env.XHS_API_BASE;

  if (apiBase) {
    try {
      const resp = await axios.get(`${apiBase}/notes`, {
        params: { keyword },
        headers: process.env.XHS_API_KEY
          ? { Authorization: `Bearer ${process.env.XHS_API_KEY}` }
          : undefined,
        timeout: 15000,
      });
      // 真实数据源结构需按实际适配，这里假设其返回 cards 字段
      return { source: 'api', cards: resp.data?.cards ?? [] };
    } catch (err) {
      console.warn('[灵感] 数据源调用失败，回退 Mock：', (err as Error).message);
    }
  }

  let data = MOCK_DATA;
  if (keyword && keyword.trim()) {
    const kw = keyword.trim();
    const filtered = MOCK_DATA.filter(
      (c) =>
        c.title.includes(kw) ||
        c.destination.includes(kw) ||
        c.tags.some((t) => t.includes(kw))
    );
    if (filtered.length > 0) data = filtered;
  }

  const cards: InspirationCard[] = data.map((c, i) => ({
    ...c,
    id: `insp-${i}`,
    cover: GRADIENTS[i % GRADIENTS.length],
  }));

  return { source: 'mock', cards };
}
