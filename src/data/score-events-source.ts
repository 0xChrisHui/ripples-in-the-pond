import 'server-only';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { KeyEvent } from '@/src/types/jam';

/**
 * /score/[id] 详情页的 events 按需加载数据源（C9b 拆出）
 *
 * 配合公开 endpoint /api/scores/[id]/events 使用：ScorePlayer 挂载时 fetch，
 * 避免 events_data 大 JSON 阻塞 SSR 首屏 HTML 输出。
 *
 * 路由 ID 与 score-source.getScoreById 同口径（tokenId 数字 / queue.id UUID 双兼容）。
 */

export async function getScoreEvents(
  id: string,
): Promise<KeyEvent[] | null> {
  let pendingScoreId: string | null = null;

  if (/^\d+$/.test(id)) {
    const n = Number(id);
    if (!Number.isSafeInteger(n)) return null;
    const { data: queueRow, error } = await supabaseAdmin
      .from('score_nft_queue')
      .select('pending_score_id')
      .eq('token_id', n)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[score-events] tokenId lookup failed:', error);
      return null;
    }
    if (!queueRow) return null;
    pendingScoreId = queueRow.pending_score_id;
  } else {
    const { data: queueRow, error } = await supabaseAdmin
      .from('score_nft_queue')
      .select('pending_score_id')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('[score-events] queue lookup failed:', error);
      return null;
    }
    if (!queueRow) return null;
    pendingScoreId = queueRow.pending_score_id;
  }

  const { data: pending, error: pErr } = await supabaseAdmin
    .from('pending_scores')
    .select('events_data')
    .eq('id', pendingScoreId)
    .maybeSingle();

  if (pErr) {
    console.error('[score-events] pending_scores query failed:', pErr);
    return [];
  }
  if (!pending || !Array.isArray(pending.events_data)) return [];
  return pending.events_data as KeyEvent[];
}
