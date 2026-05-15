'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Track, TracksListResponse } from '@/src/types/tracks';
import LoadingState from '@/src/components/common/LoadingState';
import { useAuth } from '@/src/hooks/useAuth';
import { fetchMyNFTs } from '@/src/data/nfts-source';
import { addCachedMintedId, getCachedMintedIds, setCachedMintedIds } from '@/src/lib/nft-cache';
import SphereCanvas from './SphereCanvas';
import { GROUPS, type GroupId, getGroupTargetCount, getGroupTracks, padTracksToTarget } from './sphere-config';
import { DEFAULT_EFFECTS, type EffectsConfig } from './effects-config';
import AuroraBackground from './effects/ambient/aurora-background';
import StarsBackground from './effects/ambient/stars-background';
import FogLayer from './effects/ambient/fog-layer';

interface Props {
  fullscreen?: boolean;
  effects?: EffectsConfig;
}

export default function Archipelago({ fullscreen = false, effects = DEFAULT_EFFECTS }: Props) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [tracksError, setTracksError] = useState(false);
  const [showSlowHint, setShowSlowHint] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const { authenticated, getAccessToken, userId } = useAuth();
  const [mintedTokenIds, setMintedTokenIds] = useState<Set<number>>(
    () => new Set(getCachedMintedIds(null)),
  );
  const [currentGroupId, setCurrentGroupId] = useState<GroupId>('A');
  const [fading, setFading] = useState(false);

  const loadTracks = useCallback(async () => {
    setTracksLoading(true);
    setTracksError(false);
    setShowSlowHint(false);
    setShowRetry(false);
    try {
      const res = await fetch('/api/tracks');
      if (!res.ok) throw new Error('tracks fetch failed');
      const data = (await res.json()) as TracksListResponse;
      setTracks(data.tracks);
    } catch (err) {
      console.error('首页曲目加载失败:', err);
      setTracksError(true);
      setTracks([]);
    } finally {
      setTracksLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  useEffect(() => {
    if (!tracksLoading || tracks.length > 0) return;
    const slowTimer = window.setTimeout(() => setShowSlowHint(true), 3000);
    const retryTimer = window.setTimeout(() => setShowRetry(true), 8000);
    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(retryTimer);
    };
  }, [tracksLoading, tracks.length]);

  useEffect(() => {
    if (tracks.length === 0) return;
    const padded = padTracksToTarget(getGroupTracks(currentGroupId, tracks), getGroupTargetCount(currentGroupId));
    let cancelled = false;
    const queue = padded.filter((t) => t.audio_url);
    const workers = Array.from({ length: 6 }, async () => {
      while (queue.length > 0 && !cancelled) {
        const t = queue.shift();
        if (!t?.audio_url) continue;
        try {
          await fetch(t.audio_url, { headers: { Range: 'bytes=0-307199' } });
        } catch {
          // 预热失败不影响主流程。
        }
      }
    });
    void Promise.all(workers);
    return () => {
      cancelled = true;
    };
  }, [tracks, currentGroupId]);

  useEffect(() => {
    queueMicrotask(() => setMintedTokenIds(new Set(getCachedMintedIds(userId))));
  }, [userId]);

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

  const handleGroupChange = useCallback((newGid: GroupId) => {
    if (newGid === currentGroupId || fading) return;
    setFading(true);
    setTimeout(() => {
      setCurrentGroupId(newGid);
      setTimeout(() => setFading(false), 30);
    }, 250);
  }, [currentGroupId, fading]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !t?.isContentEditable) e.preventDefault();
        return;
      }
      const idx = GROUPS.findIndex((g) => g.id === currentGroupId);
      if (e.key === 'ArrowRight') handleGroupChange(GROUPS[(idx + 1) % GROUPS.length].id);
      if (e.key === 'ArrowLeft') handleGroupChange(GROUPS[(idx - 1 + GROUPS.length) % GROUPS.length].id);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [currentGroupId, handleGroupChange]);

  if (tracks.length === 0) {
    return (
      <section className="flex h-[60vh] w-full items-center justify-center">
        <LoadingState
          title="正在唤醒群岛..."
          slowHint="网络较慢，正在重试连接..."
          showSlowHint={showSlowHint}
          showRetry={showRetry}
          error={tracksError}
          retrying={tracksLoading}
          onRetry={loadTracks}
        />
      </section>
    );
  }

  const sectionCls = fullscreen ? 'fixed inset-0 z-0' : 'flex h-[70vh] w-full max-w-6xl flex-col';
  const navCls = fullscreen ? 'absolute left-6 top-24 z-30 flex flex-col items-start gap-2' : 'mb-2 flex items-center gap-2 px-4';
  const canvasCls = fullscreen ? 'absolute inset-0' : 'flex-1';

  return (
    <section className={sectionCls}>
      {effects.aurora && <AuroraBackground />}
      {effects.stars && <StarsBackground />}
      {effects.fog && <FogLayer />}
      <nav className={navCls}>
        {GROUPS.map((g) => {
          const active = g.id === currentGroupId;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => handleGroupChange(g.id)}
              className={[
                'flex items-center gap-2 rounded px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition',
                active ? 'border border-white/10 bg-white/5 text-white/80' : 'border border-transparent text-white/30 hover:text-white/60',
              ].join(' ')}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: g.color }} />
              {g.label}
              <span className="text-[8.5px] text-white/30">{getGroupTargetCount(g.id)}</span>
            </button>
          );
        })}
        {!fullscreen && <span className="ml-auto text-[9px] tracking-[0.09em] text-white/30">DRAG · SCROLL · ← →</span>}
      </nav>
      <div className={canvasCls} style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.25s ease' }}>
        <SphereCanvas
          tracks={tracks}
          currentGroupId={currentGroupId}
          mintedIds={mintedTokenIds}
          onMinted={handleMinted}
          effects={effects}
        />
      </div>
    </section>
  );
}
