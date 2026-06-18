import { useStore } from '../store/useStore';

const STYLE = {
  success: 'from-green-400 to-emerald-500',
  error: 'from-red-400 to-rose-500',
  info: 'from-blue-400 to-indigo-500',
};
const ICON = { success: '✅', error: '⚠️', info: 'ℹ️' };

export default function Toast() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`animate-fade-up cursor-pointer text-white px-5 py-2.5 rounded-2xl shadow-glow bg-gradient-to-r ${STYLE[t.type]} flex items-center gap-2 text-sm font-medium`}
        >
          <span>{ICON[t.type]}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
