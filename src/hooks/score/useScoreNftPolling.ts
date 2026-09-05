'use client';

import { useEffect, useRef } from 'react';
import type { OwnedScoreNFT } from '@/src/types/jam';
import { fetchMyScoreNFTs } from '@/src/data/jam-source';

// A14 — 有待上链 ScoreNFT 时，每 2 分钟轮询一次刷新卡片状态
const POLL_MS = 120_000;

export function useScoreNftPolling({
  scoreNfts,
  authenticated,
  userId,
  getAccessToken,
  onRefresh,
  onError,
  onPollingChange,
}: {
  scoreNfts: OwnedScoreNFT[];
  authenticated: boolean;
  userId: string | null | undefined;
  getAccessToken: () => Promise<string | null>;
  onRefresh: (data: OwnedScoreNFT[]) => void;
  onError?: (message: string) => void;
  onPollingChange?: (polling: boolean) => void;
}) {
  // 稳定 getAccessToken 引用，避免 effect 因父 rerender 重建 interval
  const tokenRef = useRef(getAccessToken);
  useEffect(() => { tokenRef.current = getAccessToken; });
  const callbacksRef = useRef({ onRefresh, onError, onPollingChange });
  useEffect(() => { callbacksRef.current = { onRefresh, onError, onPollingChange }; });

  const hasPending = scoreNfts.some((score) => (
    score.status !== 'success' && score.status !== 'failed'
  ));

  useEffect(() => {
    if (!authenticated || !userId || !hasPending) return;
    let running = false;
    let disposed = false;
    const id = setInterval(async () => {
      if (running) return;
      running = true;
      callbacksRef.current.onPollingChange?.(true);
      try {
        const token = await tokenRef.current();
        if (!token) throw new Error('登录凭证暂不可用');
        const scores = await fetchMyScoreNFTs(token);
        if (!disposed) callbacksRef.current.onRefresh(scores);
      } catch (error) {
        console.error('唱片状态刷新失败:', error);
        if (!disposed) {
          callbacksRef.current.onError?.(
            error instanceof Error ? error.message : '唱片状态刷新失败',
          );
        }
      } finally {
        running = false;
        if (!disposed) callbacksRef.current.onPollingChange?.(false);
      }
    }, POLL_MS);
    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, [authenticated, userId, hasPending]);
}
