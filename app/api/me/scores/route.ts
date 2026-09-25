import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { ServerTiming } from '@/src/lib/performance/server-timing';
import type { KeyEvent, MyScoresResponse } from '@/src/types/jam';
import type { Track } from '@/src/types/tracks';
import { exposeTrack, type TrackRow } from '@/src/lib/track-contract';

/**
 * GET /api/me/scores
 * 返回当前用户的"未铸造活草稿"列表（"我的创作"section 用）
 *
 * B8 设计（2026-05-07）：草稿一旦入队（点击铸造）就立刻从这里消失，
 * 转去"我的唱片"显示。SQL 条件：
 *   1. status='draft' AND expires_at > now（活草稿）
 *   2. id 不在 OP queue，且没有 active / consumed / manual_review 的统一 mint claim
 *
 * 不再返回 mintingState —— 前端 useMintScore 用 5s 本地 timer 做乐观显示。
 */

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    const auth = await timing.measure('auth', () => authenticateRequest(req));
    if (!auth) {
      return timing.response(() => NextResponse.json({ error: '未登录' }, { status: 401 }));
    }

    // 兼容历史 OP queue，并以 P16 统一 claim 排除所有已选择铸造方式的草稿。
    const [queueResult, claimResult] = await timing.measure('db', () => Promise.all([
      supabaseAdmin
        .from('score_nft_queue')
        .select('pending_score_id')
        .eq('user_id', auth.userId),
      supabaseAdmin
        .from('score_mint_claims')
        .select('pending_score_id')
        .eq('user_id', auth.userId)
        .neq('status', 'released'),
    ]));
    if (queueResult.error) throw queueResult.error;
    if (claimResult.error) throw claimResult.error;

    const enqueuedIds = [...new Set([
      ...(queueResult.data ?? []).map((row) => row.pending_score_id),
      ...(claimResult.data ?? []).map((row) => row.pending_score_id),
    ])];

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
      // P3-11：拼接前断言 UUID（id 来自 DB 本不可注入，纯防御，非 UUID 直接剔除）
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const safeIds = enqueuedIds.filter((x: string) => UUID_RE.test(x));
      if (safeIds.length > 0) {
        query = query.not('id', 'in', `(${safeIds.join(',')})`);
      }
    }

    const { data: scores, error } = await timing.measure('db', () => (
      query.order('created_at', { ascending: false })
    ));

    if (error) throw error;

    // 序号：按用户该 track 的所有历史草稿数（含 expired）
    const { data: allScores } = await timing.measure('db', () => (
      supabaseAdmin
        .from('pending_scores')
        .select('track_id')
        .eq('user_id', auth.userId)
    ));

    const trackCounts = new Map<string, number>();
    for (const s of allScores ?? []) {
      trackCounts.set(s.track_id, (trackCounts.get(s.track_id) ?? 0) + 1);
    }

    const res: MyScoresResponse = {
      scores: (scores ?? []).flatMap((s) => {
        const trackRow = s.tracks as unknown as TrackRow | null;
        if (!trackRow) return []; // 联表异常 → 跳过该行
        const track: Track = exposeTrack(trackRow);
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
    return timing.response(() => NextResponse.json(res));
  } catch (err) {
    console.error('GET /api/me/scores error:', err);
    return timing.response(() => (
      NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
    ));
  }
}
