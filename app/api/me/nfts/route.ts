import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { MyNFTsResponse, OwnedNFT } from '@/src/types/tracks';

/**
 * GET /api/me/nfts
 * 返回当前登录用户铸造过的 NFT 列表，个人页消费
 * 必须登录（Authorization header）
 */

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

export async function GET(req: NextRequest) {
  try {
    // 1. 验证登录
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const claims = await privy.verifyAuthToken(token);

    // 2. 查用户
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('privy_user_id', claims.userId)
      .single();

    if (!user) {
      const res: MyNFTsResponse = { nfts: [] };
      return NextResponse.json(res);
    }

    // 3. 查铸造记录，关联 track 信息
    const { data: events, error } = await supabaseAdmin
      .from('mint_events')
      .select(`
        id,
        token_id,
        tx_hash,
        minted_at,
        tracks (id, title, week, audio_url, cover, island, created_at)
      `)
      .eq('user_id', user.id)
      .order('minted_at', { ascending: false });

    if (error) throw error;

    // 同一 token_id 去重，只保留最新一条
    const seen = new Set<number>();
    const nfts: OwnedNFT[] = [];
    for (const e of events ?? []) {
      if (seen.has(e.token_id)) continue;
      seen.add(e.token_id);
      nfts.push({
        track: e.tracks as unknown as OwnedNFT['track'],
        token_id: e.token_id,
        tx_hash: e.tx_hash,
        minted_at: e.minted_at,
      });
    }

    // 也查 mint_queue 里 pending 的，联表拿曲目名
    const { data: queued } = await supabaseAdmin
      .from('mint_queue')
      .select('token_id, created_at')
      .eq('user_id', user.id)
      .in('status', ['pending', 'minting_onchain']);

    // 批量查 pending token_id 对应的 track 信息
    const pendingTokenIds = (queued ?? [])
      .filter((q) => !seen.has(q.token_id))
      .map((q) => q.token_id);

    const tracksByWeek = new Map<number, OwnedNFT['track']>();
    if (pendingTokenIds.length > 0) {
      const { data: tracks } = await supabaseAdmin
        .from('tracks')
        .select('id, title, week, audio_url, cover, island, created_at')
        .in('week', pendingTokenIds);
      for (const t of tracks ?? []) {
        tracksByWeek.set(t.week, t as OwnedNFT['track']);
      }
    }

    for (const q of queued ?? []) {
      if (seen.has(q.token_id)) continue;
      seen.add(q.token_id);
      nfts.push({
        track: tracksByWeek.get(q.token_id) ?? null as unknown as OwnedNFT['track'],
        token_id: q.token_id,
        tx_hash: '',
        minted_at: q.created_at,
      });
    }

    const res: MyNFTsResponse = { nfts };
    return NextResponse.json(res);
  } catch (err) {
    console.error('GET /api/me/nfts error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
