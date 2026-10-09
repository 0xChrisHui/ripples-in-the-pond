import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { ServerTiming } from '@/src/lib/performance/server-timing';
import type { MyNFTsResponse, OwnedNFT } from '@/src/types/tracks';
import { exposeTrack, type TrackRow } from '@/src/lib/track-contract';

/**
 * GET /api/me/nfts
 * 返回当前登录用户的收藏记录，个人页消费。必须登录。
 * 三类来源互不去重（同一首可在首页收藏、/tracks 铸造 OP、/tracks 铸造 ETH，各占一条）：
 *   legacy  首页收藏：OP 旧 MaterialNFT（mint_events/mint_queue，无 material_contract_address）
 *   op_sbt  /tracks 的 OP SBT：同一队列，带 material_contract_address
 *   eth     /tracks 的 Ethereum NFT：material_mint_orders
 */
type QueueRef = { material_contract_address: string | null }
  | { material_contract_address: string | null }[] | null;
const editionOf = (ref: QueueRef): 'legacy' | 'op_sbt' => (
  (Array.isArray(ref) ? ref[0] : ref)?.material_contract_address ? 'op_sbt' : 'legacy');
const TRACK_COLUMNS = 'id, title, week, audio_url, arweave_url, cover, island, created_at, published';

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    const auth = await timing.measure('auth', () => authenticateRequest(req));
    if (!auth) {
      return timing.response(() => NextResponse.json({ error: '未登录' }, { status: 401 }));
    }

    const [eventsResult, queuedResult, ordersResult] = await timing.measure('db', () => Promise.all([
      supabaseAdmin.from('mint_events')
        .select(`id, token_id, tx_hash, minted_at, mint_queue:mint_queue_id (material_contract_address),
          tracks (${TRACK_COLUMNS})`)
        .eq('user_id', auth.userId).order('minted_at', { ascending: false }),
      supabaseAdmin.from('mint_queue')
        .select('id, token_id, created_at, material_contract_address')
        .eq('user_id', auth.userId).in('status', ['pending', 'minting_onchain']),
      supabaseAdmin.from('material_mint_orders')
        .select('order_id, track_id, chain_id, status, tx_hash, created_at, confirmed_at')
        .eq('user_id', auth.userId).in('status', ['sending', 'unknown', 'submitted', 'confirming', 'success']),
    ]));
    if (eventsResult.error) throw eventsResult.error;
    // 新订单表读取失败不拖垮旧收藏。
    if (ordersResult.error) console.error('GET /api/me/nfts 订单读取失败:', ordersResult.error.message);
    const queued = queuedResult.data ?? [], orders = ordersResult.data ?? [];

    // ⚠ P3-13 隐式约定：material tokenId ≡ tracks.week；ETH 订单用 track_id(=tracks.id)。
    const weeks = queued.map((q) => q.token_id), ids = orders.map((o) => o.track_id);
    const [byWeek, byId] = await timing.measure('db', async () => {
      const lookup = async (column: 'week' | 'id', values: (number | string)[]) => {
        const map = new Map<number | string, NonNullable<OwnedNFT['track']>>();
        if (values.length === 0) return map;
        const { data } = await supabaseAdmin.from('tracks').select(TRACK_COLUMNS).in(column, values);
        for (const t of data ?? []) map.set(t[column], exposeTrack(t as TrackRow));
        return map;
      };
      return Promise.all([lookup('week', weeks), lookup('id', ids)]);
    });

    const nfts: OwnedNFT[] = [
      ...(eventsResult.data ?? []).map((e): OwnedNFT => ({
        id: e.id, edition: editionOf(e.mint_queue as unknown as QueueRef), chain_id: 10, status: 'success',
        track: e.tracks ? exposeTrack(e.tracks as unknown as TrackRow) : null,
        token_id: e.token_id, tx_hash: e.tx_hash, minted_at: e.minted_at,
      })),
      ...queued.map((q): OwnedNFT => ({
        id: q.id, edition: q.material_contract_address ? 'op_sbt' : 'legacy', chain_id: 10, status: 'pending',
        track: byWeek.get(q.token_id) ?? null, token_id: q.token_id, tx_hash: '', minted_at: q.created_at,
      })),
      ...orders.map((o): OwnedNFT => ({
        id: o.order_id, edition: 'eth', chain_id: o.chain_id, status: o.status === 'success' ? 'success' : 'pending',
        track: byId.get(o.track_id) ?? null, token_id: byId.get(o.track_id)?.week ?? 0,
        tx_hash: o.tx_hash ?? '', minted_at: o.confirmed_at ?? o.created_at,
      })),
    ].sort((a, b) => Date.parse(b.minted_at) - Date.parse(a.minted_at));

    const res: MyNFTsResponse = { nfts };
    return timing.response(() => NextResponse.json(res));
  } catch (err) {
    console.error('GET /api/me/nfts error:', err);
    return timing.response(() => (
      NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
    ));
  }
}
