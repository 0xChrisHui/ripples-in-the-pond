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
}: {
  scoreNfts: OwnedScoreNFT[];
  authenticated: boolean;
  userId: string | null | undefined;
  getAccessToken: () => Promise<string | null>;
  onRefresh: (data: OwnedScoreNFT[]) => void;
}) {
  // 稳定 getAccessToken 引用，避免 effect 因父 rerender 重建 interval
  const tokenRef = useRef(getAccessToken);
  useEffect(() => { tokenRef.current = getAccessToken; });

  const hasPending = scoreNfts.some((s) => s.tokenId == null);

  useEffect(() => {
    if (!authenticated || !userId || !hasPending) return;
    const id = setInterval(async () => {
      const token = await tokenRef.current();
      if (!token) return;
      fetchMyScoreNFTs(token).then(onRefresh).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  // onRefresh = setScoreNfts，React 保证 setState 引用稳定，不加进 deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, userId, hasPending]);
}
