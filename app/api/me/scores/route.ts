import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import type { MyScoresResponse } from '@/src/types/jam';

/**
 * GET /api/me/scores
 * 返回当前用户未过期的草稿列表 + 音符数 + 序号
 */

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 查未过期草稿，拿 events_data 算音符数
    const { data: scores, error } = await supabaseAdmin
      .from('pending_scores')
      .select('id, created_at, expires_at, track_id, events_data, tracks(title)')
      .eq('user_id', auth.userId)
      .eq('status', 'draft')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 查该用户每个 track 的历史创作总数（含过期的），用来算序号
    const { data: allScores } = await supabaseAdmin
      .from('pending_scores')
      .select('track_id')
      .eq('user_id', auth.userId);

    const trackCounts = new Map<string, number>();
    for (const s of allScores ?? []) {
      trackCounts.set(s.track_id, (trackCounts.get(s.track_id) ?? 0) + 1);
    }

    const res: MyScoresResponse = {
      scores: (scores ?? []).map((s) => {
        const trackData = s.tracks as unknown as { title: string } | null;
        const events = s.events_data as unknown[];
        return {
          id: s.id,
          trackTitle: trackData?.title ?? '未知曲目',
          seq: trackCounts.get(s.track_id) ?? 1,
          eventCount: Array.isArray(events) ? events.length : 0,
          createdAt: s.created_at,
          expiresAt: s.expires_at,
        };
      }),
    };
    return NextResponse.json(res);
  } catch (err) {
    console.error('GET /api/me/scores error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
