'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Phase 6 B2 — patatap 动画层
 *
 * 全屏 canvas overlay（fixed inset-0 + pointer-events:none），盖在 SphereCanvas 之上。
 * mount 时启动 Two.js scene + RAF loop + 注册动画 + 监听 keydown。
 *
 * Phase 1 仅注册 corona（B 键）；Phase 2 扩到 21 个动画。
 *
 * 不影响主页 — 仅在挂了它的页面（/test）生效。
 */
export default function AnimationLayer() {
  const ref = useRef<HTMLDivElement>(null);
  const [registered, setRegistered] = useState<string[]>([]);

  useEffect(() => {
    if (!ref.current) return;
    let cleanup: (() => void) | undefined;
    let alive = true;

    (async () => {
      const { ensureStage, destroyStage } = await import('./two-stage');
      const { initRegistry, fire, resizeAll, getRegistered } = await import(
        './animation-registry'
      );

      if (!alive || !ref.current) return;

      const stage = ensureStage(ref.current);
      initRegistry(stage);
      setRegistered([...getRegistered()]);

      const onKey = (e: KeyboardEvent) => {
        if (e.repeat) return;
        const key = e.key.toLowerCase();
        if (key.length === 1 && key >= 'a' && key <= 'z') {
          fire(key);
        }
      };
      window.addEventListener('keydown', onKey);

      const onResize = () => resizeAll();
      window.addEventListener('resize', onResize);

      cleanup = () => {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
        destroyStage();
      };
    })();

    return () => {
      alive = false;
      cleanup?.();
    };
  }, []);

  return (
    <>
      <div ref={ref} className="pointer-events-none fixed inset-0 z-40" aria-hidden="true" />
      {/* 调试：右下角显示已注册键 */}
      {registered.length > 0 && (
        <div className="pointer-events-none fixed bottom-3 right-3 z-50 rounded bg-black/40 px-2 py-1 text-[10px] tracking-widest text-white/40">
          patatap: {registered.join(' ').toUpperCase()}
        </div>
      )}
    </>
  );
}
