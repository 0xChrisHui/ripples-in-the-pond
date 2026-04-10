'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { OwnedNFT } from '@/src/types/tracks';
import { useAuth } from '@/src/hooks/useAuth';
import { fetchMyNFTs } from '@/src/data/nfts-source';
import { getDrafts, removeDraft } from '@/src/lib/draft-store';
import { getCachedNFTs, setCachedNFTs } from '@/src/lib/nft-cache';
import { saveScore, fetchMyScores } from '@/src/data/jam-source';
import NFTCard from '@/src/components/me/NFTCard';
import DraftCard from '@/src/components/me/DraftCard';
import EmptyState from '@/src/components/me/EmptyState';

const TTL_MS = 24 * 60 * 60 * 1000;

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
  const { ready, authenticated, login, getAccessToken } = useAuth();
  const [nfts, setNfts] = useState<OwnedNFT[]>(() => getCachedNFTs());
  const [drafts, setDrafts] = useState<DisplayDraft[]>(() => {
    return getDrafts().map((d, i) => ({
      key: `local-${d.trackId}`,
      title: `创作 - #${String(i + 1).padStart(2, '0')} - ${d.eventsData.length} 音符`,
      expiresAt: new Date(new Date(d.createdAt).getTime() + TTL_MS).toISOString(),
    }));
  });
  const [loaded, setLoaded] = useState(() => getCachedNFTs().length > 0);

  useEffect(() => {
    if (!authenticated) return;

    getAccessToken().then(async (token) => {
      if (!token) return;

      // 并行：加载 NFT + 上传本地草稿 + 加载服务端草稿
      fetchMyNFTs(token).then((data) => {
        setNfts(data);
        setCachedNFTs(data);
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
        } catch {
          // 上传失败保留在本地
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
          expiresAt: new Date(new Date(d.createdAt).getTime() + TTL_MS).toISOString(),
        })),
      ];
      setDrafts(display);
    });
  }, [authenticated, getAccessToken]);

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

        {loaded && nfts.length === 0 && drafts.length === 0 && <EmptyState />}

        {nfts.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {nfts.map((nft) => (
              <NFTCard key={nft.tx_hash || `pending-${nft.token_id}`} nft={nft} />
            ))}
          </div>
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
