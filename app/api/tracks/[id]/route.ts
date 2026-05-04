import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import type { TrackDetailResponse } from '@/src/types/tracks';

/**
 * GET /api/tracks/[id]
 * 返回单曲详情 + 当前用户是否已铸造 / 是否有 pending 请求
 * 不带 Authorization 时 minted=false, pending=false
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. 查 track
    const { data: track, error } = await supabaseAdmin
      .from('tracks')
      .select('id, title, week, audio_url, cover, island, created_at, published')
      .eq('id', id)
      .single();

    if (error || !track) {
      return NextResponse.json({ error: '曲目不存在' }, { status: 404 });
    }

    // 2. 尝试识别当前用户（可选，不强制登录）
    let minted = false;
    let pending = false;

    const auth = await authenticateRequest(req);
    if (auth) {
      const { data: event } = await supabaseAdmin
        .from('mint_events')
        .select('id')
        .eq('user_id', auth.userId)
        .eq('track_id', track.id)
        .limit(1)
        .single();
      minted = !!event;

      if (!minted) {
        const { data: queue } = await supabaseAdmin
          .from('mint_queue')
          .select('id')
          .eq('user_id', auth.userId)
          .eq('token_id', track.week)
          .in('status', ['pending', 'minting_onchain'])
          .limit(1)
          .single();
        pending = !!queue;
      }
    }

    const res: TrackDetailResponse = { track, minted, pending };
    return NextResponse.json(res);
  } catch (err) {
    console.error('GET /api/tracks/[id] error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
