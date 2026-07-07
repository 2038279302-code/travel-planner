import { useEffect } from 'react';

/**
 * 在 active 为 true 期间锁定 body 滚动，用于弹窗 / 图片预览等浮层。
 * 支持多个浮层同时挂载（如 Modal 内又弹出 Lightbox）：
 * 用一个挂载计数器代替开关，只有最后一个浮层卸载时才恢复滚动，
 * 避免内层浮层关闭时把外层弹窗的滚动锁一并解除。
 *
 * 除了设置 overflow:hidden，还做了两件事：
 * 1. 用 padding-right 补偿滚动条消失导致的页面宽度跳动（桌面端）；
 * 2. 将 body 固定为 position:fixed 并记录/恢复 scrollY，彻底阻止 iOS Safari
 *    上仅靠 overflow:hidden 无法拦截的背景滚动穿透（rubber-band 效果）。
 */
let lockCount = 0;
let savedBodyStyle: {
  overflow: string;
  paddingRight: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
} | null = null;
let savedScrollY = 0;

function lock() {
  savedScrollY = window.scrollY;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  const body = document.body;

  savedBodyStyle = {
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
  };

  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) {
    const currentPaddingRight = parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
  }
  // 固定 body 到当前滚动位置，从根源上阻断移动端触摸滚动穿透到背后页面
  body.style.position = 'fixed';
  body.style.top = `-${savedScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
}

function unlock() {
  const body = document.body;
  if (savedBodyStyle) {
    body.style.overflow = savedBodyStyle.overflow;
    body.style.paddingRight = savedBodyStyle.paddingRight;
    body.style.position = savedBodyStyle.position;
    body.style.top = savedBodyStyle.top;
    body.style.left = savedBodyStyle.left;
    body.style.right = savedBodyStyle.right;
    body.style.width = savedBodyStyle.width;
    savedBodyStyle = null;
  }
  // 恢复到锁定前的滚动位置（position:fixed 期间页面视觉上不会滚动，但需要复位）
  window.scrollTo(0, savedScrollY);
}

export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      lock();
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        unlock();
      }
    };
  }, [active]);
}
