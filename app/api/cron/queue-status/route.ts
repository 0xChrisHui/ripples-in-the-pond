import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { verifyAdminToken } from '@/src/lib/auth/admin-auth';
import { SCORE_STATUSES } from '@/src/types/jam';
import { queueHealth } from '@/src/lib/alerts/queue-health';

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return NextResponse.json({ error: '无效的 admin token' }, { status: 401 });
  try {
    const now = Date.now();
    const [groups, success, failed] = await Promise.all([
      Promise.all(SCORE_STATUSES.map(async status => {
        const rows = await supabaseAdmin.from('score_nft_queue').select('created_at', { count: 'exact' })
          .eq('status', status).order('created_at').limit(1);
        if (rows.error || rows.count == null) throw Error('队列读取失败');
        const oldest = status === 'success' || status === 'failed' ? undefined : rows.data?.[0]?.created_at;
        return { status, count: rows.count, oldest,
          oldest_age_seconds: oldest ? Math.floor((now - Date.parse(oldest)) / 1000) : null };
      })),
      supabaseAdmin.from('score_nft_queue').select('updated_at').eq('status', 'success')
        .order('updated_at', { ascending: false }).limit(1),
      supabaseAdmin.from('score_nft_queue').select('id,last_error,retry_count,updated_at').eq('status', 'failed')
        .gte('updated_at', new Date(now - 86_400_000).toISOString()).not('last_error', 'is', null)
        .order('updated_at', { ascending: false }).limit(10),
    ]);
    if (success.error || failed.error) throw Error('队列历史无法读取');
    const oldest = groups.flatMap(g => g.oldest ? [g.oldest] : []).sort()[0];
    const health = queueHealth(oldest, success.data?.[0]?.updated_at, now);
    return NextResponse.json({ result: 'ok', total_queue_rows: groups.reduce((sum, g) => sum + g.count, 0),
      by_status: groups.filter(g => g.count > 0), recent_failures_24h: failed.data,
      stuck_alert: health.noProgress, waiting_too_long: health.waitingTooLong,
      stuck_threshold_seconds: 3600, generated_at: new Date(now).toISOString() });
  } catch {
    return NextResponse.json({ error: '队列数据不可读取' }, { status: 503 });
  }
}
