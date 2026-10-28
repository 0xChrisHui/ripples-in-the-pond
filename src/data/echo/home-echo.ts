import 'server-only';

import { NextResponse } from 'next/server';
import { getAddress } from 'viem';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import { ServerTiming } from '@/src/lib/performance/server-timing';
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

const defaultRequestDeps = {
  authenticate: authenticateRequest, resolve: resolveHomeEcho, chainId: CHAIN_ID_NUM,
};

/** 首页私有接口：认证后只读 origin，成功和错误响应都禁止公共缓存。 */
export async function handleHomeEchoRequest(request: Request, deps = defaultRequestDeps) {
  const timing = new ServerTiming();
  const headers = { 'Cache-Control': HOME_ECHO_CACHE_CONTROL };
  try {
    const auth = await timing.measure('auth', () => deps.authenticate(request));
    if (!auth) return timing.response(() => (
      NextResponse.json({ error: '未登录' }, { status: 401, headers })
    ));
    let wallet: string;
    try { wallet = getAddress(auth.evmAddress); } catch {
      return timing.response(() => (
        NextResponse.json({ error: '登录钱包地址无效' }, { status: 400, headers })
      ));
    }
    const body = await deps.resolve(wallet, {
      getEchoByOrigin: (origin) => timing.measure('rpc', () => getEchoByOrigin(origin)),
      readOriginQueue: (origin) => readOriginQueue(origin, timing),
      chainId: deps.chainId,
    });
    return timing.response(() => NextResponse.json(body, { headers }));
  } catch (error) {
    console.error('首页池中回声读取失败:', error);
    return timing.response(() => NextResponse.json(
      { echo: null, pending: false, error: '池中回声暂不可用' },
      { status: 503, headers },
    ));
  }
}
