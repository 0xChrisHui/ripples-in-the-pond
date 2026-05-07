'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { OwnedNFT } from '@/src/types/tracks';
import type { OwnedScoreNFT, MintingState } from '@/src/types/jam';
import { useAuth } from '@/src/hooks/useAuth';
import { fetchMyNFTs } from '@/src/data/nfts-source';
import { getDrafts, removeDraft } from '@/src/lib/draft-store';
import { getCachedNFTs, setCachedNFTs } from '@/src/lib/nft-cache';
import { saveScore, fetchMyScores, fetchMyScoreNFTs } from '@/src/data/jam-source';
import NFTCard from '@/src/components/me/NFTCard';
import ScoreNftSection from '@/src/components/me/ScoreNftSection';
import DraftSection from '@/src/components/me/DraftSection';
import EmptyState from '@/src/components/me/EmptyState';
import { DRAFT_TTL_MS } from '@/src/lib/constants';

interface DisplayDraft {
  key: string;
  title: string;
  expiresAt: string;
  /** Phase 6 B3: server 草稿带 pendingScoreId，DraftCard 据此显示铸造按钮；本地草稿不带 */
  pendingScoreId?: string;
  /** B2 P1 5/6: 服务端权威 mintingState（来自 score_nft_queue 联表），本地草稿无 */
  mintingState?: MintingState;
}

type ServerDraft = Awaited<ReturnType<typeof fetchMyScores>>[number];
type LocalDraft = ReturnType<typeof getDrafts>[number];

/** Server + local 合并成 UI 用的 DisplayDraft 数组（B2 P1 5/6 抽出避免重复） */
function buildDisplayDrafts(
  serverDrafts: ServerDraft[],
  localDrafts: LocalDraft[],
): DisplayDraft[] {
  return [
    ...serverDrafts.map((s) => ({
      key: `server-${s.id}`,
      title: `${s.trackTitle} - #${String(s.seq).padStart(2, '0')} - ${s.eventCount} 音符`,
      expiresAt: s.expiresAt,
      pendingScoreId: s.id,
      mintingState: s.mintingState,
    })),
    ...localDrafts.map((d, i) => ({
      key: `local-${d.trackId}`,
      title: `创作 - #${String(i + 1).padStart(2, '0')} - ${d.eventsData.length} 音符`,
      expiresAt: new Date(
        new Date(d.createdAt).getTime() + DRAFT_TTL_MS,
      ).toISOString(),
    })),
  ];
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
  // B2 P1 review: server fetch 是否回来过 — 控制骨架屏占位（消除"先空再有"闪烁）
  const [serverDraftsLoaded, setServerDraftsLoaded] = useState(false);
  const [scoreNftsLoaded, setScoreNftsLoaded] = useState(false);

  // 稳定 getAccessToken 引用 — Privy 不保证 useCallback 稳定性，
  // 直接放到 effect deps 会让 polling setInterval 频繁重建（永远到不了 5s tick）
  const getAccessTokenRef = useRef(getAccessToken);
  useEffect(() => {
    getAccessTokenRef.current = getAccessToken;
  });

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

      // 从服务端拿已上传的草稿（含 mintingState 联表 score_nft_queue）
      const serverDrafts = await fetchMyScores(token);
      setDrafts(buildDisplayDrafts(serverDrafts, getDrafts()));
      setServerDraftsLoaded(true);
    });
  }, [authenticated, userId, getAccessToken]);

  // B2 P1 5/6 polling：任意 draft 在 minting/queued 时每 5s 刷新；解决 Bug C 唱片不更新
  const hasMintingInFlight = drafts.some(
    (d) => d.mintingState === 'minting' || d.mintingState === 'queued',
  );
  useEffect(() => {
    if (!hasMintingInFlight || !authenticated || !userId) return;
    const tick = async () => {
      const token = await getAccessToken();
      if (!token) return;
      const [serverDrafts, scoreNftsNew] = await Promise.all([
        fetchMyScores(token),
        fetchMyScoreNFTs(token),
      ]);
      setScoreNfts(scoreNftsNew);
      setDrafts(buildDisplayDrafts(serverDrafts, getDrafts()));
    };
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [hasMintingInFlight, authenticated, userId, getAccessToken]);

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
