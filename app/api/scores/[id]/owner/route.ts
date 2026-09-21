import { NextResponse } from 'next/server';
import { getScoreOwner } from '@/src/data/score-fallback';
import { explorerAddressUrl } from '@/src/lib/chain/chain-config';

type Context = { params: Promise<{ id: string }> };

/** 当前持有人是可变态；独立短缓存读取，不能再阻塞永久播放器主体。 */
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const tokenId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(tokenId) || tokenId < 1) {
    return NextResponse.json({ error: '无效的 Score Token ID' }, { status: 400 });
  }
  try {
    const owner = await getScoreOwner(tokenId);
    const response = NextResponse.json({
      owner, href: owner ? explorerAddressUrl(owner) : null,
    });
    response.headers.set('Cache-Control', owner
      ? 'public, s-maxage=30, stale-while-revalidate=120'
      : 'public, s-maxage=5, stale-while-revalidate=15');
    return response;
  } catch (error) {
    console.error('[score-owner] ownerOf unavailable:', tokenId, error);
    return NextResponse.json({ owner: null, href: null }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
