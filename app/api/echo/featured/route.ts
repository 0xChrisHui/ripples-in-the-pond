import { NextResponse } from 'next/server';
import {
  getEchoByTokenId,
} from '@/src/data/echo/source';
import { toFeaturedEcho } from '@/src/data/echo/featured';
import { CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import type { FeaturedEchoResponse } from '@/src/types/featured-echo';

const EMPTY_CACHE = 'public, s-maxage=15, stale-while-revalidate=30';
const READY_CACHE = 'public, s-maxage=86400, stale-while-revalidate=604800';

function response(body: FeaturedEchoResponse, cacheControl: string): NextResponse {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': cacheControl },
  });
}

/** 首页只展示已完成链上铸造且永久 metadata 可严格验证的 ECHO #1。 */
export async function GET() {
  try {
    const echo = await getEchoByTokenId(1n);
    if (!echo) return response({ echo: null }, EMPTY_CACHE);
    return response({ echo: toFeaturedEcho(echo, CHAIN_ID_NUM) }, READY_CACHE);
  } catch (error) {
    console.error('GET /api/echo/featured error:', error);
    return NextResponse.json(
      { echo: null, error: 'Pond Echo 永久档案暂不可用' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
