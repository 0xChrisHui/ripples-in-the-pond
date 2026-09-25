const PRICE_URL = 'https://api.coinbase.com/v2/prices/ETH-USD/spot';

export async function GET() {
  try {
    const response = await fetch(PRICE_URL, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error(`Coinbase ${response.status}`);
    const body = await response.json() as { data?: { amount?: string } };
    const usd = Number(body.data?.amount);
    if (!Number.isFinite(usd) || usd <= 0) throw new Error('ETH/USD 返回值无效');
    return Response.json({ usd }, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('[eth-usd]', error);
    return Response.json({ error: '美元 Gas 换算暂时不可用' }, { status: 503 });
  }
}
