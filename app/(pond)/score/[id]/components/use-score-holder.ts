'use client';

import { useEffect, useState } from 'react';

export type ScoreHolderState = Readonly<{
  status: 'loading' | 'ready' | 'unavailable';
  value: string | null;
  href: string | null;
}>;

const INITIAL: ScoreHolderState = { status: 'loading', value: null, href: null };
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const EXPLORER_HOSTS = new Set([
  'optimistic.etherscan.io', 'sepolia-optimism.etherscan.io',
  'etherscan.io', 'sepolia.etherscan.io',
]);

function validHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && EXPLORER_HOSTS.has(url.host) ? url.toString() : null;
  } catch { return null; }
}

/** 可变 owner 独立补齐；离页会终止请求，失败不触碰播放器状态。 */
export function useScoreHolder(tokenId: number, asset?: {
  chainId?: number;
  currentHolder: string | null;
  holderHref: string | null;
}): ScoreHolderState {
  const [remote, setRemote] = useState<{ tokenId: number; state: ScoreHolderState }>({
    tokenId,
    state: INITIAL,
  });
  const chainId = asset?.chainId;
  const currentHolder = asset?.currentHolder ?? null;
  const holderHref = asset?.holderHref ?? null;
  useEffect(() => {
    if (chainId === 1 || chainId === 11155111) return;
    const controller = new AbortController();
    void fetch(`/api/scores/${tokenId}/owner`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ owner?: unknown; href?: unknown }>;
      })
      .then((value) => {
        if (typeof value.owner !== 'string' || !ADDRESS_RE.test(value.owner)) {
          setRemote({ tokenId, state: { status: 'unavailable', value: null, href: null } });
          return;
        }
        setRemote({ tokenId, state: { status: 'ready', value: value.owner, href: validHref(value.href) } });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error('[score-holder] 当前持有人读取失败:', error);
        setRemote({ tokenId, state: { status: 'unavailable', value: null, href: null } });
      });
    return () => controller.abort();
  }, [chainId, currentHolder, holderHref, tokenId]);
  if (chainId === 1 || chainId === 11155111) {
    return ADDRESS_RE.test(currentHolder ?? '')
      ? { status: 'ready', value: currentHolder, href: validHref(holderHref) }
      : { status: 'unavailable', value: null, href: null };
  }
  return remote.tokenId === tokenId ? remote.state : INITIAL;
}
