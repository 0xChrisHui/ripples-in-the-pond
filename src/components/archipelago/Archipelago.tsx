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
import Island from './Island';

/**
 * Archipelago — 群岛容器
 * 先从 localStorage 缓存读已铸造列表（秒开），再后台刷新
 */
export default function Archipelago() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const { authenticated, getAccessToken } = useAuth();
  const [mintedTokenIds, setMintedTokenIds] = useState<Set<number>>(
    () => new Set(getCachedMintedIds()),
  );

  useEffect(() => {
    fetchTracks().then(setTracks);
  }, []);

  // 登录后后台刷新，同步缓存
  useEffect(() => {
    if (!authenticated) return;
    getAccessToken().then((token) => {
      if (!token) return;
      fetchMyNFTs(token).then((nfts) => {
        const ids = nfts.map((n) => n.token_id);
        setMintedTokenIds(new Set(ids));
        setCachedMintedIds(ids);
      });
    });
  }, [authenticated, getAccessToken]);

  const handleMinted = useCallback((tokenId: number) => {
    setMintedTokenIds((prev) => new Set([...prev, tokenId]));
    addCachedMintedId(tokenId);
  }, []);

  if (tracks.length === 0) return null;

  return (
    <section className="flex flex-wrap items-center justify-center gap-12 px-8">
      {tracks.map((track) => (
        <Island
          key={track.id}
          track={track}
          alreadyMinted={mintedTokenIds.has(track.week)}
          onMinted={handleMinted}
        />
      ))}
    </section>
  );
}
