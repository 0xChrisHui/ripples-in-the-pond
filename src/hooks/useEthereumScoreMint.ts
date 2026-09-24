'use client';

import { useCallback } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  getAddress,
  http,
  type Address,
  type Hex,
} from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { ETHEREUM_SCORE_ABI, type MintAuthorization } from '@/src/lib/self-mint/ethereum-score-contract';
import { forgetMintHash, rememberMintHash } from '@/src/lib/self-mint/client-hash';
import { useAuth } from './useAuth';

type VoucherResponse = {
  orderId: Hex;
  chainId: 1 | 11155111;
  scoreContract: Address;
  tokenUri: string;
  authorizer: Address;
  digest: Hex;
  signature: Hex;
  authorization: Omit<MintAuthorization, 'tokenId' | 'deadline'> & {
    tokenId: string;
    deadline: number;
  };
};

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

  const sendOrder = useCallback(async (orderId: Hex) => {
    const wallet = selectedExternalWallet;
    if (!wallet || !walletCapability.canSelfPayEthGas) {
      throw new Error('当前外部钱包不可用于自付铸造');
    }
    if (!await wallet.isConnected()) throw new Error('请重新连接原钱包后再试');
    const walletAddress = getAddress(wallet.address);
    const voucher = await authorizedFetch('/api/self-mint/authorization', {
      method: 'POST', body: JSON.stringify({ orderId, walletAddress }),
    }) as VoucherResponse;
    if (getAddress(voucher.authorization.recipient) !== walletAddress) {
      throw new Error('凭证接收人与当前钱包不一致');
    }

    await wallet.switchChain(voucher.chainId);
    const chain = voucher.chainId === 1 ? mainnet : sepolia;
    const client = createPublicClient({ chain, transport: http() });
    const authorization: MintAuthorization = {
      ...voucher.authorization,
      tokenId: BigInt(voucher.authorization.tokenId),
      deadline: BigInt(voucher.authorization.deadline),
    };
    const args = [authorization, voucher.tokenUri, voucher.authorizer, voucher.signature] as const;
    await client.simulateContract({
      address: voucher.scoreContract, abi: ETHEREUM_SCORE_ABI,
      functionName: 'redeem', args, account: walletAddress,
    });
    const [gas, fees, balance] = await Promise.all([
      client.estimateContractGas({
        address: voucher.scoreContract, abi: ETHEREUM_SCORE_ABI,
        functionName: 'redeem', args, account: walletAddress,
      }),
      client.estimateFeesPerGas(),
      client.getBalance({ address: walletAddress }),
    ]);
    const gasLimit = gas * 120n / 100n;
    const maxFee = fees.maxFeePerGas ?? fees.gasPrice;
    if (!maxFee || balance < gasLimit * maxFee) {
      throw new Error('ETH 余额不足以支付当前保守 Gas 估算');
    }
    const data = encodeFunctionData({
      abi: ETHEREUM_SCORE_ABI, functionName: 'redeem', args,
    });
    const provider = await wallet.getEthereumProvider();
    const walletClient = createWalletClient({
      account: walletAddress,
      chain,
      transport: custom(provider),
    });

    await authorizedFetch('/api/self-mint/attempt', {
      method: 'POST', body: JSON.stringify({ orderId, digest: voucher.digest, walletAddress }),
    });
    let hash: Hex;
    try {
      hash = (await walletClient.sendTransaction({
        account: walletAddress,
        chain,
        to: voucher.scoreContract,
        data,
        gas: gasLimit,
      })).toLowerCase() as Hex;
      rememberMintHash(orderId, hash);
    } catch (error) {
      await authorizedFetch('/api/self-mint/attempt', {
        method: 'PATCH',
        body: JSON.stringify({
          orderId, digest: voucher.digest, walletAddress,
          outcome: userRejected(error) ? 'rejected' : 'unknown',
        }),
      }).catch(() => undefined);
      throw error;
    }
    try {
      await authorizedFetch('/api/self-mint/submission', {
        method: 'POST',
        body: JSON.stringify({ orderId, digest: voucher.digest, txHash: hash, walletAddress }),
      });
      forgetMintHash(orderId);
    } catch (error) {
      await authorizedFetch('/api/self-mint/attempt', {
        method: 'PATCH',
        body: JSON.stringify({ orderId, digest: voucher.digest, walletAddress, outcome: 'unknown' }),
      }).catch(() => undefined);
      const detail = error instanceof Error ? `；${error.message}` : '';
      throw new Error(`交易已广播 ${hash}，后台正在按订单恢复${detail}`);
    }
    return hash;
  }, [authorizedFetch, selectedExternalWallet, walletCapability.canSelfPayEthGas]);

  return { sendOrder };
}
