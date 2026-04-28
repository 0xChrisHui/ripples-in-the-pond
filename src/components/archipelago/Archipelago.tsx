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
import { GROUPS, type GroupId } from './sphere-config';

/**
 * Archipelago — sound-spheres 风格群岛容器
 *
 * Phase 6 B2.1 v3：
 * - 3 group A/B/C 切换 tab
 * - 键盘 ←/→ 切 group
 * - fade 过渡（250ms opacity 0 → swap → 1）
 *
 * fullscreen prop（Phase 6 B2 /test 用）：
 * - false (default)：原 70vh + max-w-6xl 居中布局，主页 / 用
 * - true：fixed inset-0 占满屏幕，tabs 浮顶部
 */
interface Props {
  fullscreen?: boolean;
}

export default function Archipelago({ fullscreen = false }: Props) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const { authenticated, getAccessToken, userId } = useAuth();
  const [mintedTokenIds, setMintedTokenIds] = useState<Set<number>>(
    () => new Set(getCachedMintedIds(null)),
  );
  const [currentGroupId, setCurrentGroupId] = useState<GroupId>('A');
  const [fading, setFading] = useState(false);

  useEffect(() => {
    fetchTracks().then(setTracks);
  }, []);

  // userId 变化 → 重读 cache（B1 隔离）
  useEffect(() => {
    queueMicrotask(() => setMintedTokenIds(new Set(getCachedMintedIds(userId))));
  }, [userId]);

  // 登录后后台拉真数据
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

  const handleMinted = useCallback(
    (tokenId: number) => {
      setMintedTokenIds((prev) => new Set([...prev, tokenId]));
      if (userId) addCachedMintedId(userId, tokenId);
    },
    [userId],
  );

  const handleGroupChange = useCallback(
    (newGid: GroupId) => {
      if (newGid === currentGroupId || fading) return;
      setFading(true);
      // 250ms fade out → swap group → 50ms 让 sim 启动 → fade in
      setTimeout(() => {
        setCurrentGroupId(newGid);
        setTimeout(() => setFading(false), 30);
      }, 250);
    },
    [currentGroupId, fading],
  );

  // 键盘：← / → 切 group；空格不绑业务但拦截浏览器默认翻页滚动
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 空格在 input/textarea 外都拦默认翻页行为（用户决定空格暂不赋功能）
      if (e.key === ' ' || e.code === 'Space') {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !t?.isContentEditable) {
          e.preventDefault();
        }
        return;
      }
      const idx = GROUPS.findIndex((g) => g.id === currentGroupId);
      if (e.key === 'ArrowRight') {
        handleGroupChange(GROUPS[(idx + 1) % GROUPS.length].id);
      } else if (e.key === 'ArrowLeft') {
        handleGroupChange(GROUPS[(idx - 1 + GROUPS.length) % GROUPS.length].id);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [currentGroupId, handleGroupChange]);

  if (tracks.length === 0) {
    return (
      <section className="flex h-[60vh] w-full items-center justify-center">
        <p className="text-sm text-white/30">正在唤醒群岛...</p>
      </section>
    );
  }

  const sectionCls = fullscreen
    ? 'fixed inset-0 z-0'
    : 'flex h-[70vh] w-full max-w-6xl flex-col';
  const navCls = fullscreen
    ? 'absolute left-1/2 top-16 z-30 flex -translate-x-1/2 items-center gap-2 px-4'
    : 'mb-2 flex items-center gap-2 px-4';
  const canvasCls = fullscreen ? 'absolute inset-0' : 'flex-1';

  return (
    <section className={sectionCls}>
      {/* Tabs nav（sound-spheres header 简化版）*/}
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
                active
                  ? 'border border-white/10 bg-white/5 text-white/80'
                  : 'border border-transparent text-white/30 hover:text-white/60',
              ].join(' ')}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: g.color }}
              />
              {g.label}
              <span className="text-[8.5px] text-white/30">36</span>
            </button>
          );
        })}
        {!fullscreen && (
          <span className="ml-auto text-[9px] tracking-[0.09em] text-white/30">
            DRAG · SCROLL · ← →
          </span>
        )}
      </nav>

      {/* Canvas（fade on group switch）*/}
      <div
        className={canvasCls}
        style={{
          opacity: fading ? 0 : 1,
          transition: 'opacity 0.25s ease',
        }}
      >
        <SphereCanvas
          tracks={tracks}
          currentGroupId={currentGroupId}
          mintedIds={mintedTokenIds}
          onMinted={handleMinted}
        />
      </div>
    </section>
  );
}
