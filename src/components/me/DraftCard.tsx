'use client';

import { useState, useEffect } from 'react';
import type { Draft } from '@/src/lib/draft-store';

const TTL_MS = 24 * 60 * 60 * 1000;

/** 剩余毫秒 → "Xh Ym" */
function formatRemaining(ms: number): string {
  if (ms <= 0) return '已过期';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * DraftCard — 单条草稿卡片
 * 显示曲目 trackId + 事件数 + 剩余倒计时
 */
export default function DraftCard({ draft }: { draft: Draft }) {
  const [remaining, setRemaining] = useState(() =>
    TTL_MS - (Date.now() - new Date(draft.createdAt).getTime()),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(TTL_MS - (Date.now() - new Date(draft.createdAt).getTime()));
    }, 60_000);
    return () => clearInterval(id);
  }, [draft.createdAt]);

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/70">
          {draft.eventsData.length} 个音符
        </p>
        <span
          className={[
            'text-xs',
            remaining > 3_600_000 ? 'text-white/40' : 'text-amber-400/70',
          ].join(' ')}
        >
          {formatRemaining(remaining)}
        </span>
      </div>
    </div>
  );
}
