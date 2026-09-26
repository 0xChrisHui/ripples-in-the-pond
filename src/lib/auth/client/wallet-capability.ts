'use client';

import type { ExternalWalletCheck } from '@/src/types/auth';

type VerifiedWallet = { address: string; userId: string; check: ExternalWalletCheck };
const CACHE_MS = 30_000;
const cache = new Map<string, { expiresAt: number; request: Promise<VerifiedWallet> }>();

export function getCachedWalletCapability(input: {
  address: string;
  userId: string;
  getAccessToken: () => Promise<string | null>;
}): Promise<VerifiedWallet> {
  const key = `${input.userId}:${input.address.toLowerCase()}`;
  const existing = cache.get(key);
  if (existing?.expiresAt && existing.expiresAt > Date.now()) return existing.request;
  cache.delete(key);
  const request = (async () => {
    const token = await input.getAccessToken();
    if (!token) throw new Error('登录已失效');
    const response = await fetch('/api/auth/wallet-capability', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: input.address }),
    });
    if (!response.ok) throw new Error('钱包能力核验失败');
    return {
      address: input.address,
      userId: input.userId,
      check: await response.json() as ExternalWalletCheck,
    };
  })();
  cache.set(key, { expiresAt: Date.now() + CACHE_MS, request });
  void request.then((result) => {
    // 开关刚发布或 Privy 尚未同步时，拒绝结果不能污染整个浏览器会话。
    if (!result.check.allowed && cache.get(key)?.request === request) cache.delete(key);
  });
  void request.catch(() => cache.delete(key));
  return request;
}

export function clearWalletCapabilityCache(): void {
  cache.clear();
}
