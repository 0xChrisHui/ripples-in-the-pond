'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { OwnedNFT } from '@/src/types/tracks';
import { useAuth } from '@/src/hooks/useAuth';
import { fetchMyNFTs } from '@/src/data/nfts-source';
import { getDrafts, removeDraft, type Draft } from '@/src/lib/draft-store';
import { saveScore } from '@/src/data/jam-source';
import NFTCard from '@/src/components/me/NFTCard';
import DraftCard from '@/src/components/me/DraftCard';
import EmptyState from '@/src/components/me/EmptyState';

/**
 * /me — 个人页
 * "我的收藏"（素材 NFT）+ "我的创作"（localStorage 草稿 + 倒计时）
 * 登录后自动把未过期草稿补上传到后端
 */
export default function MePage() {
  const { ready, authenticated, login, getAccessToken } = useAuth();
  const [nfts, setNfts] = useState<OwnedNFT[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 加载 NFT + 草稿 + 自动上传
  useEffect(() => {
    if (!authenticated) return;

    getAccessToken().then(async (token) => {
      if (!token) return;

      // 并行加载 NFT
      fetchMyNFTs(token).then((data) => {
        setNfts(data);
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
          // 上传失败保留在本地，下次再试
        }
      }

      // 刷新本地草稿列表
      setDrafts(getDrafts());
    });
  }, [authenticated, getAccessToken]);

  if (!ready) return null;

  if (!authenticated) {
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
              <NFTCard key={nft.tx_hash} nft={nft} />
            ))}
          </div>
        )}

        {/* 草稿区域 */}
        {drafts.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-sm font-light tracking-widest text-white/60">
              我的创作
            </h2>
            <div className="grid gap-3">
              {drafts.map((draft) => (
                <DraftCard key={draft.trackId} draft={draft} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
