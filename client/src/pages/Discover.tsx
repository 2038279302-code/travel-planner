import { useEffect, useState } from 'react';
import type { InspirationCard } from '../types';
import { AiApi } from '../api';
import { fmtLikes } from '../utils/format';

const HOT = ['京都', '大理', '成都', '曼谷', '上海', '巴厘岛', '西安'];

export default function Discover() {
  const [cards, setCards] = useState<InspirationCard[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (kw?: string) => {
    setLoading(true);
    try {
      const res = await AiApi.inspirations(kw);
      setCards(res.cards);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800">
          🔥 灵感发现
        </h1>
        <p className="text-gray-500 mt-1">看看大家都去哪儿玩，收藏你的下一站</p>
      </header>

      {/* 搜索 */}
      <div className="card p-4 animate-fade-up">
        <div className="flex gap-2">
          <input
            className="input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(keyword)}
            placeholder="搜索目的地或玩法，例如：赏枫、海岛、美食"
          />
          <button className="btn-primary" onClick={() => load(keyword)}>
            搜索
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {HOT.map((h) => (
            <button
              key={h}
              onClick={() => {
                setKeyword(h);
                load(h);
              }}
              className="chip bg-gray-100 text-gray-500 hover:bg-brand-pink/10 hover:text-brand-pink transition-colors"
            >
              #{h}
            </button>
          ))}
        </div>
      </div>

      {/* 瀑布流卡片 */}
      {loading ? (
        <div className="text-center text-gray-400 py-16">加载中…</div>
      ) : cards.length === 0 ? (
        <div className="card p-12 text-center text-gray-300">
          没有找到相关灵感，换个关键词试试～
        </div>
      ) : (
        <div className="columns-2 lg:columns-3 gap-4 space-y-4">
          {cards.map((c, i) => (
            <div
              key={c.id}
              className="card overflow-hidden break-inside-avoid cursor-pointer group animate-fade-up hover:-translate-y-1 transition-transform"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div
                className="h-32 flex items-center justify-center text-6xl"
                style={{ background: c.cover }}
              >
                <span className="group-hover:scale-110 transition-transform drop-shadow">
                  {c.coverEmoji}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-800 leading-snug">{c.title}</h3>
                <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">{c.excerpt}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {c.tags.map((t) => (
                    <span key={t} className="chip bg-brand-pink/10 text-brand-pink text-xs">
                      #{t}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                  <span>📍 {c.destination}</span>
                  <span>❤️ {fmtLikes(c.likes)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">@{c.author}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
