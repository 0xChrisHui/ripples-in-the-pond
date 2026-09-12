import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { ServerTiming } from '@/src/lib/performance/server-timing';
import type { TracksListResponse } from '@/src/types/tracks';
import { exposeTrack, type TrackRow } from '@/src/lib/track-contract';

const HOMEPAGE_TRACK_WEEK_MIN = 1;
const HOMEPAGE_TRACK_WEEK_MAX = 35;

/**
 * GET /api/tracks
 * 返回首页当前常规曲目列表，首页岛屿展示用。不需要登录。
 *
 * Phase 6 B5（finding #7）韧性改造：
 * - ISR 5 分钟（revalidate=300）：DB 抖动也能持续提供缓存
 * - DB 失败返 200 + 空 tracks + X-Degraded header，让前端不崩（首页占位态）
 *   配合 Archipelago tracks 空时显示"正在唤醒群岛..."占位
 */

export const revalidate = 300;

export async function GET() {
  const timing = new ServerTiming();
  timing.record('auth', 0);
  try {
    const { data: tracks, error } = await timing.measure('db', () => (
      supabaseAdmin
        .from('tracks')
        .select('id, title, week, audio_url, arweave_url, cover, island, created_at, published')
        .gte('week', HOMEPAGE_TRACK_WEEK_MIN)
        .lte('week', HOMEPAGE_TRACK_WEEK_MAX)
        .order('week', { ascending: true })
    ));

    if (error) throw error;

    const res: TracksListResponse = {
      tracks: (tracks as TrackRow[] | null)?.map(exposeTrack) ?? [],
    };
    return timing.response(() => NextResponse.json(res));
  } catch (err) {
    console.error('GET /api/tracks error:', err);
    const fallback: TracksListResponse = { tracks: [] };
    const res = timing.response(() => NextResponse.json(fallback, { status: 200 }));
    res.headers.set('X-Degraded', 'tracks-db-error');
    return res;
  }
}
