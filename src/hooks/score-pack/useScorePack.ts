'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createWalletClient, custom, getAddress, type Address, type Hex } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { SCORE_PACK_OPENER_ABI } from '@/src/lib/score-pack/contract';
import { useAuth } from '../useAuth';

export type PackTarget = { chainId: number; contract: string; tokenId: number };

export type PackStatus = {
  enabled: boolean;
  owner?: string | null;
  opened?: boolean;
  account?: string;
  accountDeployed?: boolean;
  readAtBlock?: string;
  contracts?: { opener: string; sounds: string; tracks: string };
  pack?: {
    txHash: string; blockNumber: string; trackTokenId: string; trackBalance: string | null;
    sounds: { id: string; balance: string }[];
  } | null;
  order?: { orderId: string; status: string; txHash: string | null } | null;
};

export type PackErrorCode = string;
const ACTIVE = new Set(['queued', 'awaiting_wallet', 'unsent', 'submitted_unknown', 'confirming']);

function userRejected(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as { code?: number | string; cause?: unknown };
    if (candidate.code === 4001 || candidate.code === '4001') return true;
    current = candidate.cause;
  }
  return false;
}

export function useScorePack(target: PackTarget) {
  const { getAccessToken, evmAddress, selectedExternalWallet, walletCapability } = useAuth();
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PackErrorCode | null>(null);
  const aliveRef = useRef(true);
  const isEth = target.chainId === 1 || target.chainId === 11155111;

  const refresh = useCallback(async () => {
    const query = new URLSearchParams({
      chainId: String(target.chainId), contract: target.contract, tokenId: String(target.tokenId),
    });
    try {
      const response = await fetch(`/api/score-pack/status?${query}`, { cache: 'no-store' });
      if (response.ok && aliveRef.current) setStatus(await response.json() as PackStatus);
    } catch { /* 读链失败时保留上一次状态 */ }
  }, [target.chainId, target.contract, target.tokenId]);

  useEffect(() => {
    aliveRef.current = true;
    void refresh();
    return () => { aliveRef.current = false; };
  }, [refresh]);

  const active = Boolean(status?.order && ACTIVE.has(status.order.status));
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => { void refresh(); }, 8_000);
    return () => clearInterval(timer);
  }, [active, refresh]);

  const viewerAddress = isEth ? selectedExternalWallet?.address : evmAddress;
  const isHolder = Boolean(viewerAddress && status?.owner
    && viewerAddress.toLowerCase() === status.owner.toLowerCase());

  const post = useCallback(async (url: string, body: Record<string, unknown>) => {
    const token = await getAccessToken();
    if (!token) throw new Error('UNAUTHENTICATED');
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await response.json() as Record<string, unknown> & { code?: string };
    if (!response.ok) throw new Error(json.code ?? 'generic');
    return json;
  }, [getAccessToken]);

  const open = useCallback(async () => {
    setBusy(true);
    setError(null);
    const base = { chainId: target.chainId, scoreContract: target.contract, tokenId: String(target.tokenId) };
    try {
      if (!isEth) {
        await post('/api/score-pack/request', base);
      } else {
        const wallet = selectedExternalWallet;
        if (!wallet || !walletCapability.canSelfPayEthGas) throw new Error('needWallet');
        if (!await wallet.isConnected()) throw new Error('needWallet');
        const walletAddress = getAddress(wallet.address);
        const issued = await post('/api/score-pack/voucher', { ...base, walletAddress }) as {
          orderId: string; opener: Address; signer: Address; signature: Hex;
          voucher: { scoreTokenId: string; holder: Address; trackTokenId: string; soundIds: string[]; deadline: string };
        };
        await wallet.switchChain(target.chainId as 1 | 11155111);
        const provider = await wallet.getEthereumProvider();
        const client = createWalletClient({
          account: walletAddress, chain: target.chainId === 1 ? mainnet : sepolia, transport: custom(provider),
        });
        const v = issued.voucher;
        const hash = await client.writeContract({
          address: issued.opener, abi: SCORE_PACK_OPENER_ABI, functionName: 'open',
          args: [{
            scoreTokenId: BigInt(v.scoreTokenId), holder: v.holder, trackTokenId: BigInt(v.trackTokenId),
            soundIds: v.soundIds.map(BigInt), deadline: BigInt(v.deadline),
          }, issued.signer, issued.signature],
        });
        // hash 只是加速提示：上报失败不当作失败，后台按链上事件对账
        await post('/api/score-pack/submission', { orderId: issued.orderId, txHash: hash, walletAddress })
          .catch(() => undefined);
      }
    } catch (caught) {
      if (userRejected(caught)) setError('rejected');
      else setError(caught instanceof Error && caught.message.length < 40 ? caught.message : 'generic');
    } finally {
      setBusy(false);
      void refresh();
    }
  }, [isEth, post, refresh, selectedExternalWallet, target.chainId, target.contract, target.tokenId,
    walletCapability.canSelfPayEthGas]);

  return { status, busy, error, isHolder, isEth, open, refresh };
}
