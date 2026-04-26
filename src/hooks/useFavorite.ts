'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from './useAuth';
import { saveScore } from '@/src/data/jam-source';
import { getDrafts, removeDraft } from '@/src/lib/draft-store';

type FavoriteStatus = 'idle' | 'success';

/**
 * 爱心收藏 hook — 乐观更新（Phase 6 G0 用户决策：失败由 ops 兜底，不通知用户）
 *
 * 点击爱心 →
 *   未登录 → 触发 Privy 登录 → 登录成功后自动完成收藏
 *   已登录 → 立即变 success（红心）→ 后台并发 /api/mint/material
 *           失败时 console.error 完整日志，UI 不回退（memory: feedback/optimistic_ui_with_rollback）
 *           ops 通过 /api/health 的 mint_queue 失败统计 + 用户反馈兜底
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
    // 乐观 UI：立即变红 + 通知 onMinted（不等后端）
    setStatus('success');
    onMintedRef.current?.(tokenId);

    // 后台并发 fetch + 草稿上传，失败仅 console.error，UI 不回退
    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('[favorite] 无法获取 token', {
          tokenId, trackId, ts: new Date().toISOString(),
        });
        return;
      }

      const mintRes = await fetch('/api/mint/material', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tokenId }),
      });

      // 409 = 已铸造过，视为成功
      if (!mintRes.ok && mintRes.status !== 409) {
        console.error('[favorite] 铸造请求失败', {
          tokenId, trackId, status: mintRes.status,
          ts: new Date().toISOString(),
        });
        return;
      }

      // 草稿上传（如有）— 失败不影响收藏
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
        } catch (err) {
          console.warn('[favorite] 草稿上传失败，保留在本地', err);
        }
      }
    } catch (err) {
      console.error('[favorite] 收藏后台调用失败', {
        tokenId, trackId, err,
        ts: new Date().toISOString(),
      });
    }
  }, [getAccessToken, tokenId, trackId]);

  // 登录成功后自动完成收藏（推到 microtask，避免 effect 同步 setState）
  useEffect(() => {
    if (authenticated && pendingRef.current) {
      pendingRef.current = false;
      queueMicrotask(doFavorite);
    }
  }, [authenticated, doFavorite]);

  const favorite = useCallback(() => {
    if (!authenticated) {
      pendingRef.current = true;
      login();
      return;
    }
    doFavorite();
  }, [authenticated, login, doFavorite]);

  return { status, favorite };
}
