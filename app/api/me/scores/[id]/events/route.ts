import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { KeyEvent } from '@/src/types/jam';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('pending_scores')
      .select('events_data')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .eq('status', 'draft')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return NextResponse.json({ error: '草稿不存在' }, { status: 404 });
    }

    const events = (Array.isArray(data.events_data) ? data.events_data : []) as KeyEvent[];
    return NextResponse.json({ events });
  } catch (err) {
    console.error('GET /api/me/scores/[id]/events error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
