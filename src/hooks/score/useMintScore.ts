'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { mintScore, fetchMyScores } from '@/src/data/jam-source';

export type MintScoreState = 'idle' | 'queued' | 'success' | 'error';

const OPTIMISTIC_SUCCESS_MS = 5_000;
// A15: 成功后轮询确认草稿消失，超时则回滚到 error
const ROLLBACK_POLL_MS = 8_000;
const ROLLBACK_TIMEOUT_MS = 60_000;

/**
 * 乐观草稿铸造 hook（A15 加失败回滚）
 *
 * 状态机：
 *   idle    → 默认 / 回滚后可重试
 *   queued  → 点击后 0-5s
 *   success → 5s 后乐观转成功 + 后台轮询确认
 *   error   → 60s 内草稿未从 /api/me/scores 消失 → 回滚，DraftCard 显示重试按钮
 */
export function useMintScore() {
  const { getAccessToken } = useAuth();
  const [state, setState] = useState<MintScoreState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startRollbackPoll = useCallback((pendingScoreId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const deadline = Date.now() + ROLLBACK_TIMEOUT_MS;
    pollRef.current = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setState('error');
        return;
      }
      const token = await getAccessToken();
      if (!token) return;
      try {
        const scores = await fetchMyScores(token);
        const stillExists = scores.some((s) => s.id === pendingScoreId);
        if (!stillExists) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          // state 保持 'success'，草稿已确认入队
        }
      } catch {
        // 网络抖动，继续轮询
      }
    }, ROLLBACK_POLL_MS);
  }, [getAccessToken]);

  const mint = useCallback(async (pendingScoreId: string) => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setState('queued');

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setState('success');
      startRollbackPoll(pendingScoreId);
    }, OPTIMISTIC_SUCCESS_MS);

    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('[mintScore] 无法获取 token', { pendingScoreId, ts: new Date().toISOString() });
        return;
      }
      await mintScore(token, pendingScoreId);
    } catch (err) {
      console.error('[mintScore] 铸造请求失败（前端乐观成功，轮询兜底）', {
        pendingScoreId, err, ts: new Date().toISOString(),
      });
    }
  }, [getAccessToken, startRollbackPoll]);

  return { state, mint };
}
