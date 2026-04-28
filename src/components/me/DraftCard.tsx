'use client';

import { useState, useEffect } from 'react';
import { useMintScore } from '@/src/hooks/useMintScore';

/** 剩余毫秒 → "Xh Ym" */
function formatRemaining(ms: number): string {
  if (ms <= 0) return '已过期';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * DraftCard — 草稿卡片（Phase 6 B3：加铸造按钮）
 *
 * 仅 server 草稿（有 pendingScoreId）显示按钮；本地草稿无按钮（等 me/page 自动上传）
 * 已过期 → 按钮变"已过期"灰色禁用（前端 UI 例外，因 ops 也无法补救硬过期）
 * 点击 → 立即变"铸造中..."（乐观 UI；memory: feedback/optimistic_ui_with_rollback）
 */
export default function DraftCard({
  title,
  expiresAt,
  pendingScoreId,
}: {
  title: string;
  expiresAt: string;
  pendingScoreId?: string;
}) {
  const [remaining, setRemaining] = useState(() =>
    new Date(expiresAt).getTime() - Date.now(),
  );
  const { state, mint } = useMintScore();

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(new Date(expiresAt).getTime() - Date.now());
    }, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const expired = remaining <= 0;
  const canMint = !!pendingScoreId && !expired && state === 'idle';
  const buttonLabel = expired
    ? '已过期'
    : !pendingScoreId
      ? '上传中...'
      : '铸造成唱片 NFT';

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

      {/* 铸造按钮 — 每个草稿都显示，本地未上传时 disabled */}
      <div className="mt-3 flex justify-end">
        {state === 'queued' ? (
          <span className="text-xs text-white/80">铸造中...</span>
        ) : (
          <button
            type="button"
            onClick={() => canMint && pendingScoreId && mint(pendingScoreId)}
            disabled={!canMint}
            className={[
              'rounded-full border px-4 py-1 text-xs transition-all',
              canMint
                ? 'border-white/40 text-white/90 hover:bg-white/10'
                : 'cursor-not-allowed border-white/10 text-white/30',
            ].join(' ')}
          >
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  );
}
