import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import type { MyScoresResponse, MintingState } from '@/src/types/jam';

/**
 * GET /api/me/scores
 * 返回当前用户的"活草稿 + 铸造中草稿"列表 + 服务端权威 mintingState
 *
 * 双路查询合并（Phase 6 B2 P1 — migration 029 后）：
 *   路径 1：活草稿  pending_scores.status='draft' AND expires_at > now
 *   路径 2：铸造中  score_nft_queue.user_id=me AND status != 'success'
 *           联回 pending_scores 拿 events_data 等元数据（status 不限，可能仍是 'draft'）
 *
 * 合并去重：029 后入队不再标 expired，活草稿和铸造中在 ID 层面会重叠，
 *   用 Map<id, row> 自然去重，最后用 queue.status 决定 mintingState。
 *
 * mintingState 映射：
 *   queue 无 row → idle / failed → failed / 中间态 → minting
 *   （'success' 不会出现在结果里，已被路径 2 过滤掉）
 */

function mapMintingState(queueStatus: string | null | undefined): MintingState {
  if (!queueStatus) return 'idle';
  if (queueStatus === 'failed') return 'failed';
  return 'minting';
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 路径 1：活草稿
    const { data: activeDrafts, error: e1 } = await supabaseAdmin
      .from('pending_scores')
      .select('id, created_at, expires_at, track_id, events_data, tracks(title)')
      .eq('user_id', auth.userId)
      .eq('status', 'draft')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (e1) throw e1;

    // 路径 2：铸造中 queue rows（含中间态 + failed，排除 success）
    const { data: queueRows, error: e2 } = await supabaseAdmin
      .from('score_nft_queue')
      .select('pending_score_id, status')
      .eq('user_id', auth.userId)
      .neq('status', 'success');

    if (e2) throw e2;

    const queueByPendingId = new Map<string, string>();
    const queuePendingIds: string[] = [];
    for (const q of queueRows ?? []) {
      queueByPendingId.set(q.pending_score_id, q.status);
      queuePendingIds.push(q.pending_score_id);
    }

    type DraftRow = NonNullable<typeof activeDrafts>[number];
    let inflightDrafts: DraftRow[] = [];
    if (queuePendingIds.length > 0) {
      const { data: rows, error: e3 } = await supabaseAdmin
        .from('pending_scores')
        .select('id, created_at, expires_at, track_id, events_data, tracks(title)')
        .in('id', queuePendingIds);

      if (e3) throw e3;
      inflightDrafts = rows ?? [];
    }

    // 合并 + 按 created_at 倒序
    const merged = new Map<string, DraftRow>();
    for (const s of activeDrafts ?? []) merged.set(s.id, s);
    for (const s of inflightDrafts) merged.set(s.id, s);
    const allDrafts = Array.from(merged.values()).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    // 序号：按用户该 track 的所有历史草稿数（含 expired），保持原语义
    const { data: allScores } = await supabaseAdmin
      .from('pending_scores')
      .select('track_id')
      .eq('user_id', auth.userId);

    const trackCounts = new Map<string, number>();
    for (const s of allScores ?? []) {
      trackCounts.set(s.track_id, (trackCounts.get(s.track_id) ?? 0) + 1);
    }

    const res: MyScoresResponse = {
      scores: allDrafts.map((s) => {
        const trackData = s.tracks as unknown as { title: string } | null;
        const events = s.events_data as unknown[];
        return {
          id: s.id,
          trackTitle: trackData?.title ?? '未知曲目',
          seq: trackCounts.get(s.track_id) ?? 1,
          eventCount: Array.isArray(events) ? events.length : 0,
          createdAt: s.created_at,
          expiresAt: s.expires_at,
          mintingState: mapMintingState(queueByPendingId.get(s.id)),
        };
      }),
    };
    return NextResponse.json(res);
  } catch (err) {
    console.error('GET /api/me/scores error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
