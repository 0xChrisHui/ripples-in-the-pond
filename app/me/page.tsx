'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { OwnedNFT } from '@/src/types/tracks';
import { useAuth } from '@/src/hooks/useAuth';
import { fetchMyNFTs } from '@/src/data/nfts-source';
import NFTCard from '@/src/components/me/NFTCard';
import EmptyState from '@/src/components/me/EmptyState';

/**
 * /me — 个人页
 * 未登录：提示登录。已登录：显示 NFT 列表或空状态。
 */
export default function MePage() {
  const { ready, authenticated, login } = useAuth();
  const [nfts, setNfts] = useState<OwnedNFT[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    fetchMyNFTs().then((data) => {
      setNfts(data);
      setLoaded(true);
    });
  }, [authenticated]);

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

        {loaded && nfts.length === 0 && <EmptyState />}

        {nfts.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {nfts.map((nft) => (
              <NFTCard key={nft.token_id} nft={nft} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
