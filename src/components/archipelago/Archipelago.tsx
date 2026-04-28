'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Track } from '@/src/types/tracks';
import { fetchTracks } from '@/src/data/tracks-source';
import { useAuth } from '@/src/hooks/useAuth';
import { fetchMyNFTs } from '@/src/data/nfts-source';
import {
  getCachedMintedIds,
  setCachedMintedIds,
  addCachedMintedId,
} from '@/src/lib/nft-cache';
import SphereCanvas from './SphereCanvas';

/**
 * Archipelago — 群岛容器
 * 先从 localStorage 缓存读已铸造列表（秒开），再后台刷新
 *
 * Phase 6 B1：cache 按 userId 隔离；userId 变化时重读对应 key
 */
export default function Archipelago() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const { authenticated, getAccessToken, userId } = useAuth();
  // 初次渲染拿不到 userId（Privy 还在 hydrate），先用 anon key 兜底
  const [mintedTokenIds, setMintedTokenIds] = useState<Set<number>>(
    () => new Set(getCachedMintedIds(null)),
  );

  useEffect(() => {
    fetchTracks().then(setTracks);
  }, []);

  // userId 变化（登录 / 切号 / 登出）→ 重读对应 user 的本地缓存
  // 推到 microtask 避免 React 19 react-hooks/set-state-in-effect 警告
  useEffect(() => {
    queueMicrotask(() => setMintedTokenIds(new Set(getCachedMintedIds(userId))));
  }, [userId]);

  // 登录后后台刷新真实数据，写回当前 user 的缓存
  useEffect(() => {
    if (!authenticated || !userId) return;
    getAccessToken().then((token) => {
      if (!token) return;
      fetchMyNFTs(token).then((nfts) => {
        const ids = nfts.map((n) => n.token_id);
        setMintedTokenIds(new Set(ids));
        setCachedMintedIds(userId, ids);
      });
    });
  }, [authenticated, userId, getAccessToken]);

  const handleMinted = useCallback((tokenId: number) => {
    setMintedTokenIds((prev) => new Set([...prev, tokenId]));
    if (userId) addCachedMintedId(userId, tokenId);
  }, [userId]);

  // Phase 6 B5 #7：tracks 空时显示占位（加载中 / DB degraded 都走这条），不再 return null
  if (tracks.length === 0) {
    return (
      <section className="flex h-[60vh] w-full items-center justify-center">
        <p className="text-sm text-white/30">正在唤醒群岛...</p>
      </section>
    );
  }

  // Phase 6 B2.1：sound-spheres 风格 force-directed canvas（替代原 Island grid）
  return (
    <section className="h-[60vh] w-full max-w-6xl px-4">
      <SphereCanvas
        tracks={tracks}
        mintedIds={mintedTokenIds}
        onMinted={handleMinted}
      />
    </section>
  );
}
