import type { Hex } from 'viem';

const HASH = /^0x[0-9a-fA-F]{64}$/;

function key(orderId: Hex): string {
  return `self-mint:transaction:${orderId.toLowerCase()}`;
}

export function rememberMintHash(orderId: Hex, hash: Hex): void {
  try { window.localStorage.setItem(key(orderId), hash.toLowerCase()); } catch { /* 服务端仍会恢复。 */ }
}

export function readMintHash(orderId: Hex): Hex | null {
  try {
    const hash = window.localStorage.getItem(key(orderId));
    return hash && HASH.test(hash) ? hash.toLowerCase() as Hex : null;
  } catch { return null; }
}

export function forgetMintHash(orderId: Hex): void {
  try { window.localStorage.removeItem(key(orderId)); } catch { /* 服务端真值不受影响。 */ }
}

export async function recoverMintHash(input: {
  orderId: Hex; digest: Hex; txHash: Hex; walletAddress: string; accessToken: string;
}): Promise<void> {
  const response = await fetch('/api/self-mint/submission', {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? '交易登记失败，请稍后重试');
  forgetMintHash(input.orderId);
}
