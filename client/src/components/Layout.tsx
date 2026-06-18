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
      <Toast />

      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 backdrop-blur-lg bg-white/70 border-b border-white/60">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => navigate('/')}
          >
            <span className="text-2xl animate-float">🗺️</span>
            <span className="text-xl font-extrabold bg-gradient-to-r from-brand-pink via-brand-purple to-brand-blue bg-clip-text text-transparent">
              漫游手账
            </span>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
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
      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="text-center text-xs text-gray-400 py-8">
        漫游手账 · 记录每一段旅程的美好 🌈
      </footer>
    </div>
  );
}
