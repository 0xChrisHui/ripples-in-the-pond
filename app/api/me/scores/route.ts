import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import type { KeyEvent, MyScoresResponse } from '@/src/types/jam';
import type { Track } from '@/src/types/tracks';

/**
 * GET /api/me/scores
 * 返回当前用户的"未铸造活草稿"列表（"我的创作"section 用）
 *
 * B8 设计（2026-05-07）：草稿一旦入队（点击铸造）就立刻从这里消失，
 * 转去"我的唱片"显示。SQL 条件：
 *   1. status='draft' AND expires_at > now（活草稿）
 *   2. id NOT IN (user 的 score_nft_queue.pending_score_id 集合)
 *
 * 不再返回 mintingState —— 前端 useMintScore 用 5s 本地 timer 做乐观显示。
 */

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 拿 user 已入队的 pending_score_id 集合（用于 SQL NOT IN 排除）
    const { data: queueRows, error: qErr } = await supabaseAdmin
      .from('score_nft_queue')
      .select('pending_score_id')
      .eq('user_id', auth.userId);
    if (qErr) throw qErr;

    const enqueuedIds = (queueRows ?? []).map((q) => q.pending_score_id);

    const light = req.nextUrl.searchParams.get('light') === '1';

    // 活草稿 + 未过期 + NOT IN 已入队
    const selectColumns = light
      ? 'id, created_at, expires_at, track_id, event_count, tracks(*)'
      : 'id, created_at, expires_at, track_id, events_data, tracks(*)';
    let query = supabaseAdmin
      .from('pending_scores')
      .select(selectColumns)
      .eq('user_id', auth.userId)
      .eq('status', 'draft')
      .gt('expires_at', new Date().toISOString());

    if (enqueuedIds.length > 0) {
      // PostgREST 语法：not.in.(uuid1,uuid2)；UUID 字面量不需要引号
      query = query.not('id', 'in', `(${enqueuedIds.join(',')})`);
    }

    const { data: scores, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) throw error;

    // 序号：按用户该 track 的所有历史草稿数（含 expired）
    const { data: allScores } = await supabaseAdmin
      .from('pending_scores')
      .select('track_id')
      .eq('user_id', auth.userId);

    const trackCounts = new Map<string, number>();
    for (const s of allScores ?? []) {
      trackCounts.set(s.track_id, (trackCounts.get(s.track_id) ?? 0) + 1);
    }

    const res: MyScoresResponse = {
      scores: (scores ?? []).flatMap((s) => {
        const track = s.tracks as unknown as Track | null;
        if (!track) return []; // 联表异常 → 跳过该行
        const row = s as {
          events_data?: unknown;
          event_count?: number | null;
        };
        const events = (Array.isArray(row.events_data) ? row.events_data : []) as KeyEvent[];
        const eventCount = light ? (row.event_count ?? 0) : events.length;
        return [{
          id: s.id,
          track,
          ...(light ? {} : { events }),
          seq: trackCounts.get(s.track_id) ?? 1,
          eventCount,
          createdAt: s.created_at,
          expiresAt: s.expires_at,
        }];
      }),
    };
    return NextResponse.json(res);
  } catch (err) {
    console.error('GET /api/me/scores error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
