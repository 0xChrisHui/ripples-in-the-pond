'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { OwnedNFT } from '@/src/types/tracks';
import type { OwnedScoreNFT } from '@/src/types/jam';
import { useAuth } from '@/src/hooks/useAuth';
import { fetchMyNFTs } from '@/src/data/nfts-source';
import { getDrafts, removeDraft } from '@/src/lib/draft-store';
import { getCachedNFTs, setCachedNFTs } from '@/src/lib/nft-cache';
import { saveScore, fetchMyScores, fetchMyScoreNFTs } from '@/src/data/jam-source';
import NFTCard from '@/src/components/me/NFTCard';
import ScoreCard from '@/src/components/me/ScoreCard';
import DraftCard from '@/src/components/me/DraftCard';
import EmptyState from '@/src/components/me/EmptyState';
import { DRAFT_TTL_MS } from '@/src/lib/constants';

interface DisplayDraft {
  key: string;
  title: string;
  expiresAt: string;
}

/**
 * /me — 个人页
 * 先从 localStorage 缓存秒开，后台静默刷新
 * 草稿来源：localStorage（未上传）+ 服务端（已上传）
 */
export default function MePage() {
  const { ready, authenticated, login, getAccessToken, userId } = useAuth();
  const [scoreNfts, setScoreNfts] = useState<OwnedScoreNFT[]>([]);
  // 初次渲染拿不到 userId（Privy hydrate 中），先用 anon key 兜底
  const [nfts, setNfts] = useState<OwnedNFT[]>(() => getCachedNFTs(null));
  const [drafts, setDrafts] = useState<DisplayDraft[]>(() => {
    return getDrafts().map((d, i) => ({
      key: `local-${d.trackId}`,
      title: `创作 - #${String(i + 1).padStart(2, '0')} - ${d.eventsData.length} 音符`,
      expiresAt: new Date(new Date(d.createdAt).getTime() + DRAFT_TTL_MS).toISOString(),
    }));
  });
  const [loaded, setLoaded] = useState(false);

  // userId 变化（登录 / 切号 / 登出）→ 重读对应 user 的本地缓存
  // 推到 microtask 避免 React 19 react-hooks/set-state-in-effect 警告
  useEffect(() => {
    queueMicrotask(() => {
      const cached = getCachedNFTs(userId);
      setNfts(cached);
      setLoaded(cached.length > 0);
    });
  }, [userId]);

  useEffect(() => {
    if (!authenticated || !userId) return;

    getAccessToken().then(async (token) => {
      if (!token) return;

      // 并行：加载 ScoreNFT + MaterialNFT + 上传本地草稿 + 加载服务端草稿
      fetchMyScoreNFTs(token).then(setScoreNfts).catch(console.error);
      fetchMyNFTs(token).then((data) => {
        setNfts(data);
        setCachedNFTs(userId, data);
        setLoaded(true);
      });

      // 自动上传 localStorage 草稿
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

      // 从服务端拿已上传的草稿
      const serverDrafts = await fetchMyScores(token);
      const remaining = getDrafts();

      const display: DisplayDraft[] = [
        ...serverDrafts.map((s) => ({
          key: `server-${s.id}`,
          title: `${s.trackTitle} - #${String(s.seq).padStart(2, '0')} - ${s.eventCount} 音符`,
          expiresAt: s.expiresAt,
        })),
        ...remaining.map((d, i) => ({
          key: `local-${d.trackId}`,
          title: `创作 - #${String(i + 1).padStart(2, '0')} - ${d.eventsData.length} 音符`,
          expiresAt: new Date(new Date(d.createdAt).getTime() + DRAFT_TTL_MS).toISOString(),
        })),
      ];
      setDrafts(display);
    });
  }, [authenticated, userId, getAccessToken]);

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

        {/* 我的乐谱（ScoreNFT） */}
        {scoreNfts.length > 0 && (
          <section>
            <h2 className="mb-4 text-sm font-light tracking-widest text-white/60">
              我的乐谱
            </h2>
            <div className="grid gap-3">
              {scoreNfts.map((s) => (
                <ScoreCard key={s.tokenId} score={s} />
              ))}
            </div>
          </section>
        )}

        {/* 素材 NFT */}
        {nfts.length > 0 && (
          <section className={scoreNfts.length > 0 ? 'mt-10' : ''}>
            <h2 className="mb-4 text-sm font-light tracking-widest text-white/60">
              素材收藏
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {nfts.map((nft) => (
                <NFTCard key={nft.tx_hash || `pending-${nft.token_id}`} nft={nft} />
              ))}
            </div>
          </section>
        )}

        {drafts.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-sm font-light tracking-widest text-white/60">
              我的创作
            </h2>
            <div className="grid gap-3">
              {drafts.map((d) => (
                <DraftCard key={d.key} title={d.title} expiresAt={d.expiresAt} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
