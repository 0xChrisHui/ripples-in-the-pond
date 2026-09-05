import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { ServerTiming } from '@/src/lib/performance/server-timing';
import type { SoundsListResponse } from '@/src/types/jam';

/**
 * GET /api/sounds
 * 返回 26 个键盘音效列表，首页合奏用。不需要登录。
 */
export async function GET() {
  const timing = new ServerTiming();
  timing.record('auth', 0);
  try {
    const { data: sounds, error } = await timing.measure('db', () => (
      supabaseAdmin
        .from('sounds')
        .select('id, token_id, name, audio_url, duration_ms, category, key')
        .order('token_id', { ascending: true })
    ));

    if (error) throw error;

    const res: SoundsListResponse = { sounds: sounds ?? [] };
    return timing.response(() => NextResponse.json(res));
  } catch (err) {
    console.error('GET /api/sounds error:', err);
    return timing.response(() => (
      NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
    ));
  }
}
