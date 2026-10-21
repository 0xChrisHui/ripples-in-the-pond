// 首页私有 Echo：只返回 origin == 登录钱包 的那一枚，不看现持有人。
// 成功及错误响应均禁止公共缓存，避免不同登录身份之间串用数据。
import { NextRequest, NextResponse } from 'next/server';
import { getAddress } from 'viem';
import { HOME_ECHO_CACHE_CONTROL, resolveHomeEcho } from '@/src/data/echo/home-echo';
import { readOriginQueue } from '@/src/data/echo/origin-queue';
import { getEchoByOrigin } from '@/src/data/echo/source';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import { ServerTiming } from '@/src/lib/performance/server-timing';

export async function GET(request: NextRequest) {
  const timing = new ServerTiming();
  const headers = { 'Cache-Control': HOME_ECHO_CACHE_CONTROL };
  try {
    const auth = await timing.measure('auth', () => authenticateRequest(request));
    if (!auth) return timing.response(() => (
      NextResponse.json({ error: '未登录' }, { status: 401, headers })
    ));
    let wallet: string;
    try { wallet = getAddress(auth.evmAddress); } catch {
      return timing.response(() => (
        NextResponse.json({ error: '登录钱包地址无效' }, { status: 400, headers })
      ));
    }
    const body = await resolveHomeEcho(wallet, {
      getEchoByOrigin: (origin) => timing.measure('rpc', () => getEchoByOrigin(origin)),
      readOriginQueue: (origin) => readOriginQueue(origin, timing),
      chainId: CHAIN_ID_NUM,
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
