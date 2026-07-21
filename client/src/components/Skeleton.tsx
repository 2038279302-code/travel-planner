/**
 * 统一的加载态组件（P2-5）：
 * - PageLoading：整页/整块内容加载时使用，复用 AiPlanner 已有的 emoji 动画风格，
 *   比纯文本"加载中…"更有产品质感，也让全站加载体验保持一致。
 * - CardGridSkeleton：卡片墙/瀑布流场景使用的骨架屏占位，避免首屏白屏到内容之间的
 *   突兀跳变，让用户对即将出现的内容形状有预期。
 */

/** 整页/整块内容加载态：emoji 浮动动画 + 提示文案 */
export function PageLoading({
  emoji = '🧭',
  text = '正在加载…',
}: {
  emoji?: string;
  text?: string;
}) {
  return (
    <div className="card p-10 text-center animate-fade-up" role="status" aria-live="polite">
      <div className="text-5xl animate-float" aria-hidden="true">
        {emoji}
      </div>
      <p className="text-gray-400 mt-3">{text}</p>
    </div>
  );
}

/** 单张卡片骨架屏：用灰色占位块模拟标题/描述/元信息的排版结构 */
function SkeletonCard() {
  return (
    <div className="card overflow-hidden animate-pulse" aria-hidden="true">
      <div className="h-28 bg-gray-100" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-100 rounded-full w-2/3" />
        <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        <div className="flex gap-2 pt-1">
          <div className="h-3 bg-gray-100 rounded-full w-1/4" />
          <div className="h-3 bg-gray-100 rounded-full w-1/4" />
        </div>
      </div>
    </div>
  );
}

/** 卡片网格骨架屏：Dashboard 旅行卡片墙 / Discover 灵感瀑布流等场景复用 */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      role="status"
      aria-label="内容加载中"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
