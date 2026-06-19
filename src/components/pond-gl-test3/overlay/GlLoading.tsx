'use client';

import { useEffect, useState } from 'react';

/**
 * J4 — GL 水塘加载/失败浮层（居中，盖在夜塘基调之上）。
 * 取数中：「唤醒水塘…」脉动；慢网（>3s）追加一行提示。失败：「加载失败，点击重试」按钮。
 * 不再像之前那样黑屏一下、球突然蹦出来。pointer-events 仅按钮接管。
 */
export default function GlLoading({ error, onRetry }: { error: boolean; onRetry: () => void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (error) return;
    const t = window.setTimeout(() => setSlow(true), 3000);
    return () => window.clearTimeout(t);
  }, [error]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center gap-2 text-center">
      {error ? (
        <button
          type="button"
          onClick={onRetry}
          className="pointer-events-auto rounded border border-white/15 bg-white/5 px-4 py-2 text-[13px] text-white/80 hover:bg-white/10"
        >
          加载失败，点击重试
        </button>
      ) : (
        <>
          <div className="animate-pulse text-sm tracking-[0.3em] text-white/55">唤醒水塘…</div>
          {slow && <div className="text-[11px] tracking-wide text-white/30">网络较慢，正在连接…</div>}
        </>
      )}
    </div>
  );
}
