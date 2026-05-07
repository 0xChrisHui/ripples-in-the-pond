'use client';

import { useState, useEffect } from 'react';
import { useMintScore } from '@/src/hooks/useMintScore';
import type { MintingState } from '@/src/types/jam';

function formatRemaining(ms: number): string {
  if (ms <= 0) return '已过期';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * DraftCard — 草稿卡片（B2 P1 5/6 加服务端 mintingState 权威）
 *
 * 显示优先级：
 *   1. expired → 「已过期」（前端拦截）
 *   2. mintingState ∈ {minting, success, failed} → 服务端权威态
 *   3. clientState === 'queued' && mintingState === 'idle' → 「铸造中...」乐观瞬态
 *   4. !pendingScoreId → 「上传中...」（本地草稿，等自动 POST）
 *   5. 否则可点的「铸造成唱片 NFT」按钮
 */
export default function DraftCard({
  title,
  expiresAt,
  pendingScoreId,
  mintingState = 'idle',
}: {
  title: string;
  expiresAt: string;
  pendingScoreId?: string;
  mintingState?: MintingState;
}) {
  const [remaining, setRemaining] = useState(() =>
    new Date(expiresAt).getTime() - Date.now(),
  );
  const { state: clientState, mint } = useMintScore();

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(new Date(expiresAt).getTime() - Date.now());
    }, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const expired = remaining <= 0;
  const effective: MintingState =
    mintingState !== 'idle'
      ? mintingState
      : clientState === 'queued'
        ? 'minting'
        : 'idle';

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

      <div className="mt-3 flex justify-end">
        {expired ? (
          <span className="rounded-full border border-white/10 px-4 py-1 text-xs text-white/30">
            已过期
          </span>
        ) : effective === 'minting' ? (
          <span className="text-xs text-white/80">铸造中...</span>
        ) : effective === 'success' ? (
          <span className="text-xs text-emerald-400/90">铸造成功 ✓</span>
        ) : effective === 'failed' ? (
          <span className="text-xs text-red-400/80">铸造失败 · 请联系运营</span>
        ) : !pendingScoreId ? (
          <span className="rounded-full border border-white/10 px-4 py-1 text-xs text-white/30">
            上传中...
          </span>
        ) : (
          <button
            type="button"
            onClick={() => pendingScoreId && mint(pendingScoreId)}
            className="rounded-full border border-white/40 px-4 py-1 text-xs text-white/90 transition-all hover:bg-white/10"
          >
            铸造成唱片 NFT
          </button>
        )}
      </div>
    </div>
  );
}
