'use client';

/**
 * H6 — prefers-reduced-motion 单例（缓存 + 监听变更）。
 *
 * 自动运动（球自漂、常驻微波）在用户开了"减少动态效果"时应弱化/关闭；
 * 用户主动触发的涟漪（指针/拖拽/穿越溅起）属交互反馈，不在弱化范围。
 * 每帧调用方多（sphere-motion / ripple-feed），故缓存布尔值、用 matchMedia change 事件更新，
 * 不在热路径里反复跑 matchMedia。SSR 安全（window 守卫，默认 false）。
 */

let reduced = false;
let inited = false;

function ensureInit(): void {
  if (inited || typeof window === 'undefined' || !window.matchMedia) return;
  inited = true;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduced = mq.matches;
  mq.addEventListener('change', (e) => { reduced = e.matches; });
}

/** 用户是否要求减少动态效果（自动运动据此弱化/关闭） */
export function prefersReducedMotion(): boolean {
  if (!inited) ensureInit();
  return reduced;
}
