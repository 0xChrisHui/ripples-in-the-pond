import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { ScorePreviewResponse } from '@/src/types/jam';

/**
 * GET /api/scores/[id]/preview
 * 返回草稿数据供前端回放。私有：只有本人能看。
 * 过期草稿返回 404。
 */

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. 验证登录
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '缺少 Authorization header' }, { status: 401 });
    }
    const claims = await privy.verifyAuthToken(authHeader.slice(7));
    const privyUserId = claims.userId;

    // 2. 查找用户
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('privy_user_id', privyUserId)
      .single();

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 });
    }

    // 3. 查找草稿
    const { id: scoreId } = await params;
    const { data: score } = await supabaseAdmin
      .from('pending_scores')
      .select('track_id, events_data, expires_at, user_id, status')
      .eq('id', scoreId)
      .single();

    // 不存在、不是本人、已过期 → 统一 404（不泄露信息）
    if (!score || score.user_id !== user.id || score.status !== 'draft') {
      return NextResponse.json({ error: '草稿不存在' }, { status: 404 });
    }

    // 4. 检查是否已超过 expires_at
    if (new Date(score.expires_at) < new Date()) {
      return NextResponse.json({ error: '草稿不存在' }, { status: 404 });
    }

    const res: ScorePreviewResponse = {
      score: {
        trackId: score.track_id,
        eventsData: score.events_data,
        expiresAt: score.expires_at,
      },
    };
    return NextResponse.json(res);
  } catch (err) {
    console.error('GET /api/scores/[id]/preview error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
