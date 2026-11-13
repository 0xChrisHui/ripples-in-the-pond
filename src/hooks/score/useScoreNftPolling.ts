'use client';

import { useEffect, useRef } from 'react';
import type { OwnedScoreNFT } from '@/src/types/jam';
import { fetchMyScoreNFTs } from '@/src/data/jam-source';

import { pollingDelay } from './polling-delay';

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

  const interval = pollingDelay(scoreNfts);
  useEffect(() => {
    if (!authenticated || !userId || !interval) return;
    let running = false;
    let disposed = false;
    const refresh = async () => {
      if (running || document.visibilityState === 'hidden') return;
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
    };
    const id = setInterval(refresh, interval);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [authenticated, userId, interval]);
}
