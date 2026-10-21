import 'server-only';

import { CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import type { PersonalEchoHomeResponse } from '@/src/types/featured-echo';
import type { WalletRecipeQueueStatus } from '@/src/types/wallet-recipe';
import { toFeaturedEcho } from './featured';
import { readOriginQueue } from './origin-queue';
import { getEchoByOrigin } from './source';

export const HOME_ECHO_CACHE_CONTROL = 'private, no-store';

const defaultDeps = { getEchoByOrigin, readOriginQueue, chainId: CHAIN_ID_NUM };

/** success 也继续等待：队列已成功时，RPC 仍可能尚未读到铸造结果。 */
export function isOriginEchoPending(status: WalletRecipeQueueStatus | null): boolean {
  return status === 'pending' || status === 'preparing_media'
    || status === 'uploading_metadata' || status === 'minting_onchain'
    || status === 'confirming_onchain' || status === 'safe_retry' || status === 'success';
}

/** 只按 origin 选择该钱包自己生成的 Echo，转走后仍返回。 */
export async function resolveHomeEcho(
  wallet: string,
  deps = defaultDeps,
): Promise<PersonalEchoHomeResponse> {
  const view = await deps.getEchoByOrigin(wallet);
  if (view) return { echo: toFeaturedEcho(view, deps.chainId), pending: false };
  const { row, unavailable } = await deps.readOriginQueue(wallet);
  if (unavailable) {
    console.error('首页池中回声的 origin 队列读取暂不可用');
    return { echo: null, pending: false };
  }
  return { echo: null, pending: isOriginEchoPending(row?.status ?? null) };
}
