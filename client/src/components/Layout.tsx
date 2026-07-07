import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Toast from './Toast';

const NAV = [
  { to: '/', label: '我的旅行', emoji: '🧳', end: true },
  { to: '/ai', label: 'AI 规划', emoji: '🤖' },
  { to: '/discover', label: '灵感发现', emoji: '🔥' },
];

export default function Layout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen">
      {/* 跳过导航链接：默认隐藏，键盘 Tab 聚焦时显现，方便纯键盘/屏幕阅读器用户跳过导航直达正文 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-2xl focus:bg-white focus:shadow-glow focus:text-brand-pink"
      >
        跳转到主内容
      </a>
      <Toast />

      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 backdrop-blur-lg bg-white/70 border-b border-white/60">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-2 select-none"
            onClick={() => navigate('/')}
            aria-label="回到首页"
          >
            <span className="text-2xl animate-float">🗺️</span>
            <span className="text-xl font-extrabold bg-gradient-to-r from-brand-pink via-brand-purple to-brand-blue bg-clip-text text-transparent">
              漫游手账
            </span>
          </button>

          <nav className="flex items-center gap-1 sm:gap-2" aria-label="主导航">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                aria-label={n.label}
                className={({ isActive }) =>
                  `px-3 sm:px-4 py-2 rounded-2xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-pink to-brand-orange text-white shadow-glow'
                      : 'text-gray-500 hover:bg-white hover:text-brand-pink'
                  }`
                }
              >
                <span className="mr-1">{n.emoji}</span>
                <span className="hidden sm:inline">{n.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* 主体 */}
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="text-center text-xs text-gray-400 py-8">
        漫游手账 · 记录每一段旅程的美好 🌈
      </footer>
    </div>
  );
}
