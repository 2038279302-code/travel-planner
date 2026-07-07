import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  title,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`);
  // 记录点击是否始于遮罩本身，避免"卡片内拖选文本松手到遮罩上"被误判为点击遮罩
  const pointerDownOnOverlay = useRef(false);

  useLockBodyScroll(open);

  // ESC 键关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 打开时：记录触发焦点的元素、把焦点移入弹窗；关闭时：把焦点还给触发元素
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // 优先聚焦弹窗内第一个可交互元素，找不到则聚焦弹窗容器本身
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? dialogRef.current)?.focus();

    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Tab 焦点循环：把焦点锁定在弹窗内，避免键盘用户 Tab 到背后页面
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;

  return createPortal(
    // 遮罩层：占满视口，自身不滚动（滚动交给弹窗卡片内部），点击遮罩关闭
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/40 backdrop-blur-sm"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
      onMouseDown={(e) => {
        pointerDownOnOverlay.current = e.target === overlayRef.current;
      }}
      onClick={(e) => {
        // 只有 mousedown 和 click 都发生在遮罩本身（而非弹窗内容）才关闭，
        // 避免在卡片内拖选文本、松手时越界到遮罩导致误关闭
        if (e.target === overlayRef.current && pointerDownOnOverlay.current) onClose();
        pointerDownOnOverlay.current = false;
      }}
    >
      {/* 居中容器：内容短时居中，内容长时从顶部开始 */}
      <div className="min-h-full flex items-center justify-center px-4 sm:px-6">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId.current}
          tabIndex={-1}
          className={`card w-full ${maxWidth} animate-fade-up flex flex-col max-h-[85vh] overflow-hidden outline-none`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题栏：固定不随内容滚动 */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0 border-b border-gray-100/80">
            <h3 id={titleId.current} className="text-xl font-bold text-gray-800">
              {title}
            </h3>
            <button
              onClick={onClose}
              aria-label="关闭弹窗"
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0"
            >
              ✕
            </button>
          </div>
          {/* 内容区：超出高度时内部滚动，标题栏始终可见 */}
          <div className="px-6 py-5 overflow-y-auto overscroll-contain">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
