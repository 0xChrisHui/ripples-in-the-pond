import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { TracksListResponse } from '@/src/types/tracks';

/**
 * GET /api/tracks
 * 返回所有曲目列表，首页岛屿展示用。不需要登录。
 *
 * Phase 6 B5（finding #7）韧性改造：
 * - ISR 5 分钟（revalidate=300）：DB 抖动也能持续提供缓存
 * - DB 失败返 200 + 空 tracks + X-Degraded header，让前端不崩（首页占位态）
 *   配合 Archipelago tracks 空时显示"正在唤醒群岛..."占位
 */

export const revalidate = 300;

export async function GET() {
  try {
    const { data: tracks, error } = await supabaseAdmin
      .from('tracks')
      .select('id, title, week, audio_url, cover, island, created_at')
      .order('week', { ascending: true });

    if (error) throw error;

    const res: TracksListResponse = { tracks: tracks ?? [] };
    return NextResponse.json(res);
  } catch (err) {
    console.error('GET /api/tracks error:', err);
    const fallback: TracksListResponse = { tracks: [] };
    const res = NextResponse.json(fallback, { status: 200 });
    res.headers.set('X-Degraded', 'tracks-db-error');
    return res;
  }
}
