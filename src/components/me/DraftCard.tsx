'use client';

import { useState, useEffect } from 'react';

/** 剩余毫秒 → "Xh Ym" */
function formatRemaining(ms: number): string {
  if (ms <= 0) return '已过期';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * DraftCard — 草稿卡片
 * 格式：深渊 - #01 - 20 音符 | 23h 45m
 */
export default function DraftCard({ title, expiresAt }: {
  title: string;
  expiresAt: string;
}) {
  const [remaining, setRemaining] = useState(() =>
    new Date(expiresAt).getTime() - Date.now(),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(new Date(expiresAt).getTime() - Date.now());
    }, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/70">{title}</p>
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
