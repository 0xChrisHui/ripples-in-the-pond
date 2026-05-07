'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { OwnedNFT } from '@/src/types/tracks';
import type { OwnedScoreNFT } from '@/src/types/jam';
import { useAuth } from '@/src/hooks/useAuth';
import { fetchMyNFTs } from '@/src/data/nfts-source';
import { getDrafts, removeDraft } from '@/src/lib/draft-store';
import { getCachedNFTs, setCachedNFTs } from '@/src/lib/nft-cache';
import { saveScore, fetchMyScores, fetchMyScoreNFTs } from '@/src/data/jam-source';
import NFTCard from '@/src/components/me/NFTCard';
import ScoreNftSection from '@/src/components/me/ScoreNftSection';
import DraftSection, { type DisplayDraft } from '@/src/components/me/DraftSection';
import EmptyState from '@/src/components/me/EmptyState';

type ServerDraft = Awaited<ReturnType<typeof fetchMyScores>>[number];
type LocalDraft = ReturnType<typeof getDrafts>[number];

/**
 * Server + local 合并成 UI 用的 DisplayDraft 数组。
 * 过期草稿由数据源 filter：服务端 GET /api/me/scores 已 filter，
 * 本地 draft-store.getDrafts() 也已 filter（24h TTL）。
 */
function buildDisplayDrafts(
  serverDrafts: ServerDraft[],
  localDrafts: LocalDraft[],
): DisplayDraft[] {
  return [
    ...serverDrafts.map((s) => ({
      key: `server-${s.id}`,
      title: `${s.track.title} - #${String(s.seq).padStart(2, '0')} - ${s.eventCount} 音符`,
      pendingScoreId: s.id,
      track: s.track,
      events: s.events,
    })),
    ...localDrafts.map((d, i) => ({
      key: `local-${d.trackId}`,
      title: `创作 - #${String(i + 1).padStart(2, '0')} - ${d.eventsData.length} 音符`,
    })),
  ];
}

/**
 * /me — 个人页
 * 先从 localStorage 缓存秒开，后台静默刷新
 * 草稿来源：localStorage（未上传）+ 服务端（已上传未入队）
 */
export default function MePage() {
  const { ready, authenticated, login, getAccessToken, userId } = useAuth();
  const [scoreNfts, setScoreNfts] = useState<OwnedScoreNFT[]>([]);
  const [nfts, setNfts] = useState<OwnedNFT[]>(() => getCachedNFTs(null));
  const [drafts, setDrafts] = useState<DisplayDraft[]>(() =>
    buildDisplayDrafts([], getDrafts()),
  );
  const [loaded, setLoaded] = useState(false);
  const [serverDraftsLoaded, setServerDraftsLoaded] = useState(false);
  const [scoreNftsLoaded, setScoreNftsLoaded] = useState(false);

  // 稳定 getAccessToken 引用：Privy 不保证 useCallback 稳定，
  // 直接放进 effect deps 会导致 fetch / saveScore loop 因父 rerender 重复触发
  const getAccessTokenRef = useRef(getAccessToken);
  useEffect(() => {
    getAccessTokenRef.current = getAccessToken;
  });

  useEffect(() => {
    queueMicrotask(() => {
      const cached = getCachedNFTs(userId);
      setNfts(cached);
      setLoaded(cached.length > 0);
    });
  }, [userId]);

  useEffect(() => {
    if (!authenticated || !userId) return;

    getAccessTokenRef.current().then(async (token) => {
      if (!token) return;

      fetchMyScoreNFTs(token)
        .then((data) => {
          setScoreNfts(data);
          setScoreNftsLoaded(true);
        })
        .catch((err) => {
          console.error(err);
          setScoreNftsLoaded(true);
        });
      fetchMyNFTs(token).then((data) => {
        setNfts(data);
        setCachedNFTs(userId, data);
        setLoaded(true);
      });

      const localDrafts = getDrafts();
      for (const draft of localDrafts) {
        try {
          await saveScore(token, {
            trackId: draft.trackId,
            eventsData: draft.eventsData,
            createdAt: draft.createdAt,
          });
          removeDraft(draft.trackId);
        } catch (err) {
          console.error('草稿上传失败，保留在本地:', err);
        }
      }

      const serverDrafts = await fetchMyScores(token);
      setDrafts(buildDisplayDrafts(serverDrafts, getDrafts()));
      setServerDraftsLoaded(true);
    });
  }, [authenticated, userId]);

  if (!ready && nfts.length === 0) return null;

  if (!authenticated && nfts.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black">
        <p className="text-white/50">请先登录查看你的收藏</p>
        <button
          type="button"
          onClick={login}
          className="rounded-full border border-white/20 px-6 py-2 text-sm text-white hover:bg-white/10"
        >
          登录
        </button>
        <Link href="/" className="text-xs text-white/30 hover:text-white/50">
          ← 返回首页
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-lg font-light tracking-widest text-white/80">
            我的收藏
          </h1>
          <Link href="/" className="text-xs text-white/30 hover:text-white/50">
            ← 首页
          </Link>
        </div>

        {loaded && nfts.length === 0 && drafts.length === 0 && scoreNfts.length === 0 && <EmptyState />}

        <ScoreNftSection
          scoreNfts={scoreNfts}
          showSkeleton={authenticated && !scoreNftsLoaded}
        />

        {nfts.length > 0 && (
          <section className={scoreNfts.length > 0 || (authenticated && !scoreNftsLoaded) ? 'mt-10' : ''}>
            <h2 className="mb-4 text-sm font-light tracking-widest text-white/60">
              音乐收藏
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {nfts.map((nft) => (
                <NFTCard key={nft.tx_hash || `pending-${nft.token_id}`} nft={nft} />
              ))}
            </div>
          </section>
        )}

        <DraftSection
          drafts={drafts}
          showSkeleton={authenticated && !serverDraftsLoaded}
        />
      </div>
    </main>
  );
}
