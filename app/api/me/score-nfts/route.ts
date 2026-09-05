import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { SCORE_STATUSES, type MyScoreNFTsResponse, type OwnedScoreNFT, type ScoreMintStatus } from '@/src/types/jam';

function readStatus(value: unknown): ScoreMintStatus {
  if (typeof value === 'string' && SCORE_STATUSES.some((status) => status === value)) {
    return value as ScoreMintStatus;
  }
  throw new Error(`未知 Score 状态: ${String(value)}`);
}

/**
 * GET /api/me/score-nfts
 * 返回当前用户的"我的唱片"列表 — B8 重设（2026-05-08）
 *
 * 数据源 = score_nft_queue 全部 row（**不再** filter status='success'）。
 * 用户感知"我的唱片"与链上完成度脱钩；token_id / tx_hash 是 progressive enhancement，
 * 未上链时为 null，前端显示"上链中"，cron 跑完后字段补齐。
 *
 * eventCount 来源：联表 pending_scores.event_count（migration 031 generated column，
 * 不再拉整个 events_data jsonb 数组算 length）— P1-19 修复（2026-05-08 strict CTO review）。
 */

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from('score_nft_queue')
      .select(`
        id, token_id, tx_hash, created_at, status, failure_kind,
        tracks(title),
        pending_scores(event_count)
      `)
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const scoreNfts: OwnedScoreNFT[] = (rows ?? []).map((r) => {
      const trackData = r.tracks as unknown as { title: string } | null;
      const ps = r.pending_scores as unknown as { event_count: number | null } | null;
      const status = readStatus(r.status);
      const failureKind = r.failure_kind === 'safe_retry' || r.failure_kind === 'manual_review'
        ? r.failure_kind
        : null;
      return {
        id: status === 'success' && r.token_id != null ? String(r.token_id) : r.id,
        queueId: r.id,
        tokenId: r.token_id ?? undefined,
        status,
        trackTitle: trackData?.title ?? '未知曲目',
        eventCount: ps?.event_count ?? null,
        txHash: r.tx_hash ?? undefined,
        failureKind,
        submittedAt: r.created_at,
      };
    });

    const res: MyScoreNFTsResponse = { scoreNfts };
    return NextResponse.json(res);
  } catch (err) {
    console.error('GET /api/me/score-nfts error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
