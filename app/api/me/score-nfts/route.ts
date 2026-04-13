import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { resolveArUrl } from '@/src/lib/arweave';
import type { MyScoreNFTsResponse, OwnedScoreNFT } from '@/src/types/jam';

/**
 * GET /api/me/score-nfts
 * 返回当前用户已铸造成功的 ScoreNFT 列表，个人页"我的乐谱"消费
 */

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 查已铸造成功的 ScoreNFT，关联 track 拿曲目名
    const { data: rows, error } = await supabaseAdmin
      .from('score_nft_queue')
      .select('token_id, cover_ar_tx_id, tx_hash, created_at, track_id, pending_score_id, tracks(title)')
      .eq('user_id', auth.userId)
      .eq('status', 'success')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 查 events 数量：从 mint_events.score_data 取
    const tokenIds = (rows ?? []).map((r) => r.token_id).filter(Boolean);
    const eventCounts = new Map<number, number>();
    if (tokenIds.length > 0) {
      const { data: events } = await supabaseAdmin
        .from('mint_events')
        .select('score_nft_token_id, score_data')
        .in('score_nft_token_id', tokenIds);
      for (const e of events ?? []) {
        const data = e.score_data as unknown[];
        eventCounts.set(
          e.score_nft_token_id,
          Array.isArray(data) ? data.length : 0,
        );
      }
    }

    const scoreNfts: OwnedScoreNFT[] = (rows ?? [])
      .filter((r) => r.token_id != null)
      .map((r) => {
        const trackData = r.tracks as unknown as { title: string } | null;
        return {
          tokenId: r.token_id!,
          trackTitle: trackData?.title ?? '未知曲目',
          coverUrl: resolveArUrl(r.cover_ar_tx_id),
          eventCount: eventCounts.get(r.token_id!) ?? 0,
          txHash: r.tx_hash ?? '',
          mintedAt: r.created_at,
        };
      });

    const res: MyScoreNFTsResponse = { scoreNfts };
    return NextResponse.json(res);
  } catch (err) {
    console.error('GET /api/me/score-nfts error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
