'use client';

import { useEffect, useState } from 'react';

export type ScoreHolderState = Readonly<{
  status: 'loading' | 'ready' | 'unavailable';
  value: string | null;
  href: string | null;
}>;

const INITIAL: ScoreHolderState = { status: 'loading', value: null, href: null };
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const EXPLORER_HOSTS = new Set(['optimistic.etherscan.io', 'sepolia-optimism.etherscan.io']);

function validHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && EXPLORER_HOSTS.has(url.host) ? url.toString() : null;
  } catch { return null; }
}

/** 可变 owner 独立补齐；离页会终止请求，失败不触碰播放器状态。 */
export function useScoreHolder(tokenId: number): ScoreHolderState {
  const [state, setState] = useState<ScoreHolderState>(INITIAL);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/scores/${tokenId}/owner`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ owner?: unknown; href?: unknown }>;
      })
      .then((value) => {
        if (typeof value.owner !== 'string' || !ADDRESS_RE.test(value.owner)) {
          setState({ status: 'unavailable', value: null, href: null });
          return;
        }
        setState({ status: 'ready', value: value.owner, href: validHref(value.href) });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error('[score-holder] 当前持有人读取失败:', error);
        setState({ status: 'unavailable', value: null, href: null });
      });
    return () => controller.abort();
  }, [tokenId]);
  return state;
}
