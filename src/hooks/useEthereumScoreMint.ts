'use client';

import { useCallback, useRef } from 'react';
import { createWalletClient, custom, getAddress, type Hex } from 'viem';
import { forgetMintHash, rememberMintHash } from '@/src/lib/self-mint/client-hash';
import {
  buildMintTransactionPlan,
  type MintTransactionPlan,
} from '@/src/lib/self-mint/client/transaction-plan';
import { useAuth } from './useAuth';

function userRejected(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as { code?: number | string; cause?: unknown };
    if (candidate.code === 4001 || candidate.code === '4001') return true;
    current = candidate.cause;
  }
  return false;
}

export function useEthereumScoreMint() {
  const { selectedExternalWallet, walletCapability, getAccessToken } = useAuth();
  const planRef = useRef<{ key: string; promise: Promise<MintTransactionPlan> } | null>(null);

  const authorizedFetch = useCallback(async (url: string, init: RequestInit) => {
    const token = await getAccessToken();
    if (!token) throw new Error('登录已失效');
    const response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
    });
    const body = await response.json() as { error?: string };
    if (!response.ok) throw new Error(body.error ?? '请求失败');
    return body;
  }, [getAccessToken]);

  const getPlan = useCallback((orderId: Hex, walletAddress: `0x${string}`) => {
    const key = `${orderId}:${walletAddress}`;
    if (planRef.current?.key === key) return planRef.current.promise;
    const promise = buildMintTransactionPlan({ orderId, walletAddress, authorizedFetch });
    planRef.current = { key, promise };
    void promise.catch(() => {
      if (planRef.current?.promise === promise) planRef.current = null;
    });
    return promise;
  }, [authorizedFetch]);

  const prepareOrder = useCallback(async (orderId: Hex) => {
    const wallet = selectedExternalWallet;
    if (!wallet || !walletCapability.canSelfPayEthGas) return;
    await getPlan(orderId, getAddress(wallet.address));
  }, [getPlan, selectedExternalWallet, walletCapability.canSelfPayEthGas]);

  const sendOrder = useCallback(async (orderId: Hex, expectedChainId: 1 | 11155111) => {
    const wallet = selectedExternalWallet;
    if (!wallet || !walletCapability.canSelfPayEthGas) {
      throw new Error('当前外部钱包不可用于自付铸造');
    }
    if (!await wallet.isConnected()) throw new Error('请重新连接原钱包后再试');
    const walletAddress = getAddress(wallet.address);
    let [plan] = await Promise.all([
      getPlan(orderId, walletAddress),
      wallet.switchChain(expectedChainId),
    ]);
    if (plan.voucher.chainId !== expectedChainId) throw new Error('订单网络与签名凭证不一致');
    if (plan.voucher.authorization.deadline <= Math.floor(Date.now() / 1000) + 30) {
      planRef.current = null;
      plan = await getPlan(orderId, walletAddress);
    }

    const provider = await wallet.getEthereumProvider();
    const walletClient = createWalletClient({
      account: walletAddress,
      chain: plan.chain,
      transport: custom(provider),
    });
    await authorizedFetch('/api/self-mint/attempt', {
      method: 'POST',
      body: JSON.stringify({ orderId, digest: plan.voucher.digest, walletAddress }),
    });
    let hash: Hex;
    try {
      hash = (await walletClient.sendTransaction({
        account: walletAddress,
        chain: plan.chain,
        to: plan.voucher.scoreContract,
        data: plan.data,
        gas: plan.gasLimit,
      })).toLowerCase() as Hex;
      rememberMintHash(orderId, hash);
    } catch (error) {
      await authorizedFetch('/api/self-mint/attempt', {
        method: 'PATCH',
        body: JSON.stringify({
          orderId, digest: plan.voucher.digest, walletAddress,
          outcome: userRejected(error) ? 'rejected' : 'unknown',
        }),
      }).catch(() => undefined);
      throw error;
    }
    try {
      await authorizedFetch('/api/self-mint/submission', {
        method: 'POST',
        body: JSON.stringify({ orderId, digest: plan.voucher.digest, txHash: hash, walletAddress }),
      });
      forgetMintHash(orderId);
    } catch (error) {
      await authorizedFetch('/api/self-mint/attempt', {
        method: 'PATCH',
        body: JSON.stringify({
          orderId, digest: plan.voucher.digest, walletAddress, outcome: 'unknown',
        }),
      }).catch(() => undefined);
      const detail = error instanceof Error ? `；${error.message}` : '';
      throw new Error(`交易已广播 ${hash}，后台正在按订单恢复${detail}`);
    } finally {
      planRef.current = null;
    }
    return hash;
  }, [authorizedFetch, getPlan, selectedExternalWallet, walletCapability.canSelfPayEthGas]);

  return { prepareOrder, sendOrder };
}
