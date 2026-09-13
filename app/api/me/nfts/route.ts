import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { ServerTiming } from '@/src/lib/performance/server-timing';
import type { MyNFTsResponse, OwnedNFT } from '@/src/types/tracks';
import { exposeTrack, type TrackRow } from '@/src/lib/track-contract';

/**
 * GET /api/me/nfts
 * 返回当前登录用户铸造过的 NFT 列表，个人页消费
 * 必须登录（Authorization header）
 */

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    const auth = await timing.measure('auth', () => authenticateRequest(req));
    if (!auth) {
      return timing.response(() => NextResponse.json({ error: '未登录' }, { status: 401 }));
    }

    // 3. 查铸造记录，关联 track 信息
    const { data: events, error } = await timing.measure('db', () => (
      supabaseAdmin
        .from('mint_events')
        .select(`
          id,
          token_id,
          tx_hash,
          minted_at,
          tracks (id, title, week, audio_url, arweave_url, cover, island, created_at, published)
        `)
        .eq('user_id', auth.userId)
        .order('minted_at', { ascending: false })
    ));

    if (error) throw error;

    // 同一 token_id 去重，只保留最新一条
    const seen = new Set<number>();
    const nfts: OwnedNFT[] = [];
    for (const e of events ?? []) {
      if (seen.has(e.token_id)) continue;
      seen.add(e.token_id);
      nfts.push({
        track: e.tracks ? exposeTrack(e.tracks as unknown as TrackRow) : null,
        token_id: e.token_id,
        tx_hash: e.tx_hash,
        minted_at: e.minted_at,
      });
    }

    // 也查 mint_queue 里 pending 的，联表拿曲目名
    const { data: queued } = await timing.measure('db', () => (
      supabaseAdmin
        .from('mint_queue')
        .select('token_id, created_at')
        .eq('user_id', auth.userId)
        .in('status', ['pending', 'minting_onchain'])
    ));

    // 批量查 pending token_id 对应的 track 信息
    const pendingTokenIds = (queued ?? [])
      .filter((q) => !seen.has(q.token_id))
      .map((q) => q.token_id);

    const tracksByWeek = new Map<number, NonNullable<OwnedNFT['track']>>();
    if (pendingTokenIds.length > 0) {
      // ⚠ P3-13 隐式约定：material tokenId ≡ tracks.week（全仓一致，见 mint 入队 + steps.markSuccess）。
      //   若将来 tokenId 与 week 语义分叉，这里会显示错曲目 —— 届时需引入显式关联列。
      const { data: tracks } = await timing.measure('db', () => (
        supabaseAdmin
          .from('tracks')
          .select('id, title, week, audio_url, arweave_url, cover, island, created_at, published')
          .in('week', pendingTokenIds)
      ));
      for (const t of tracks ?? []) {
        tracksByWeek.set(t.week, exposeTrack(t as TrackRow));
      }
    }

    for (const q of queued ?? []) {
      if (seen.has(q.token_id)) continue;
      seen.add(q.token_id);
      nfts.push({
        track: tracksByWeek.get(q.token_id) ?? null,
        token_id: q.token_id,
        tx_hash: '',
        minted_at: q.created_at,
      });
    }

    const res: MyNFTsResponse = { nfts };
    return timing.response(() => NextResponse.json(res));
  } catch (err) {
    console.error('GET /api/me/nfts error:', err);
    return timing.response(() => (
      NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
    ));
  }
}
