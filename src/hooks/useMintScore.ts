'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from './useAuth';
import { mintScore } from '@/src/data/jam-source';

type MintScoreState = 'idle' | 'queued' | 'success';

const OPTIMISTIC_SUCCESS_MS = 5000;

/**
 * 乐观草稿铸造 hook（B8 重设）
 *
 * 状态机：
 *   idle    → 默认
 *   queued  → 点击后 0-5s（DraftCard 显示"铸造中..."）
 *   success → 5s 后强制转（DraftCard 显示"铸造成功 ✓"）
 *
 * 设计要点：
 * - 5s 后强制 success 不依赖后台 cron 进度（B8 规则 2 用户期望）
 * - 实际链上失败由后台邮件告警 + 运营手动重铸兜底，前端不感知
 * - 用户切走 /me 再回来：草稿在 GET /api/me/scores 已被 NOT IN queue 排除
 *   → DraftCard 不再渲染（草稿"消失"），跑去"我的唱片"显示
 */
export function useMintScore() {
  const { getAccessToken } = useAuth();
  const [state, setState] = useState<MintScoreState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 卸载时清 timer，避免 setState on unmounted（React 19 已 silent，但保持干净）
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const mint = useCallback(async (pendingScoreId: string) => {
    setState('queued');

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setState('success');
    }, OPTIMISTIC_SUCCESS_MS);

    // 后台 API 调用：失败仅日志（UI 已乐观）
    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('[mintScore] 无法获取 token', {
          pendingScoreId, ts: new Date().toISOString(),
        });
        return;
      }
      await mintScore(token, pendingScoreId);
    } catch (err) {
      console.error('[mintScore] 铸造请求失败（前端仍显示乐观成功）', {
        pendingScoreId, err,
        ts: new Date().toISOString(),
      });
    }
  }, [getAccessToken]);

  return { state, mint };
}
