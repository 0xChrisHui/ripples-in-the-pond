'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from './useAuth';
import { saveScore } from '@/src/data/jam-source';
import { getDrafts, removeDraft } from '@/src/lib/draft-store';

type FavoriteStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * 爱心收藏 hook — 决策 16 状态机
 *
 * 点击爱心 →
 *   未登录 → 触发 Privy 登录 → 登录成功后自动完成收藏
 *   已登录 → 直接铸造 + 上传草稿
 */
export function useFavorite(
  tokenId: number,
  trackId: string,
  onMinted?: (tokenId: number) => void,
) {
  const { authenticated, login, getAccessToken } = useAuth();
  const [status, setStatus] = useState<FavoriteStatus>('idle');
  const pendingRef = useRef(false);
  const onMintedRef = useRef(onMinted);
  useEffect(() => { onMintedRef.current = onMinted; }, [onMinted]);

  const doFavorite = useCallback(async () => {
    // 乐观更新：立刻变红心，失败不回退（后端静默重试）
    setStatus('success');
    onMintedRef.current?.(tokenId);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('无法获取 token');

      // 1. 铸造素材 NFT
      const mintRes = await fetch('/api/mint/material', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tokenId,
          idempotencyKey: `mint-${tokenId}-${Date.now()}`,
        }),
      });

      // 409 = 已铸造过，视为成功
      if (!mintRes.ok && mintRes.status !== 409) {
        throw new Error('铸造请求失败');
      }

      // 2. 尝试上传该 track 的草稿（如有）
      const drafts = getDrafts();
      const draft = drafts.find((d) => d.trackId === trackId);
      if (draft) {
        try {
          await saveScore(token, {
            trackId: draft.trackId,
            eventsData: draft.eventsData,
            createdAt: draft.createdAt,
          });
          removeDraft(draft.trackId);
        } catch {
          console.warn('[favorite] 草稿上传失败，保留在本地');
        }
      }
    } catch (err) {
      // 不回退红心，不告诉用户——开发者从日志排查
      console.error('[favorite] 后端失败，需排查:', err);
    }
  }, [getAccessToken, tokenId, trackId]);

  // 登录成功后自动完成收藏
  useEffect(() => {
    if (authenticated && pendingRef.current) {
      pendingRef.current = false;
      doFavorite();
    }
  }, [authenticated, doFavorite]);

  const favorite = useCallback(async () => {
    if (!authenticated) {
      pendingRef.current = true;
      login();
      return;
    }
    doFavorite();
  }, [authenticated, login, doFavorite]);

  const reset = useCallback(() => setStatus('idle'), []);

  return { status, favorite, reset };
}
