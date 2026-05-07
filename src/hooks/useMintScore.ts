'use client';

import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { mintScore } from '@/src/data/jam-source';

type MintScoreState = 'idle' | 'queued';

/**
 * 乐观草稿铸造 hook（Phase 6 B3 / B2 P1 5/6 校准注释）
 *
 * 职责限于"客户端乐观瞬态"：点击 → API 返回前的过渡显示。
 * 真正的铸造态权威源是 /api/me/scores 返回的 mintingState（联表 score_nft_queue）。
 * DraftCard 渲染优先级：服务端 mintingState 优先于本 hook.state（hook 仅在
 * mintingState === 'idle' 时才用 hook.state === 'queued' 兜底显示"铸造中"瞬态）。
 *
 * 这样能解决 离开 /me → 重进 hook unmount → state 蒸发的 Bug A：
 * 重进时拿不到 hook 状态没关系，从 /api/me/scores 拿服务端 mintingState 即可。
 *
 * 失败兜底：pending_scores 即使 status='expired' 也保留 events_data，
 *   ops 可通过 /api/health 的 scoreQueue 失败统计 + 用户反馈手动重铸
 */
export function useMintScore() {
  const { getAccessToken } = useAuth();
  const [state, setState] = useState<MintScoreState>('idle');

  const mint = useCallback(async (pendingScoreId: string) => {
    // 乐观：立即变 queued
    setState('queued');

    // 后台 API 调，失败仅日志，UI 不回退
    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('[mintScore] 无法获取 token', {
          pendingScoreId, ts: new Date().toISOString(),
        });
        return;
      }
      await mintScore(token, pendingScoreId);
    } catch (err) {
      console.error('[mintScore] 铸造请求失败', {
        pendingScoreId, err,
        ts: new Date().toISOString(),
      });
    }
  }, [getAccessToken]);

  return { state, mint };
}
