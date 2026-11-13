import { supabaseAdmin } from '@/src/lib/supabase';
import { queueHealth, heartbeatLate } from '@/src/lib/alerts/queue-health';
import { positiveLimit } from '@/src/lib/rate-limit/quota';

export type Notice = { queue: string; kind: string; message: string };
export async function inspectQueue(table: 'mint_queue' | 'score_nft_queue', states: string[], notices: Notice[]) {
  const [pending, success] = await Promise.all([
    supabaseAdmin.from(table).select('created_at', { count: 'exact' }).in('status', states)
      .order('created_at').limit(1),
    supabaseAdmin.from(table).select('updated_at').eq('status', 'success').order('updated_at', { ascending: false }).limit(1),
  ]);
  if (pending.error || success.error || pending.count == null) throw Error('队列读取失败');
  const oldest = pending.data?.[0]?.created_at;
  const health = queueHealth(oldest, success.data?.[0]?.updated_at);
  const age = health.waitingTooLong ? '；最早订单已等待超过三小时' : '';
  const add = (kind: string, message: string) => notices.push({ queue: table, kind, message: message + age });
  if (pending.count >= positiveLimit(process.env.QUEUE_BACKLOG_ALERT, 200)) add('backlog', `积压 ${pending.count} 单`);
  if (health.noProgress) add('no-progress', '有等待超过一小时的订单，最近一小时没有成功完成的订单');
  if (table === 'score_nft_queue' && pending.count) {
    const last = await supabaseAdmin.from('system_kv').select('value').eq('key', 'score-queue:last-run').maybeSingle();
    if (last.error) throw last.error;
    if (heartbeatLate(pending.count, last.data?.value)) add('heartbeat', '评分队列超过十分钟未报告调度');
  }
  return pending.count;
}

export async function manualSummary(notices: Notice[]) {
  const rows = await supabaseAdmin.from('score_nft_queue').select('id', { count: 'exact' })
    .eq('status', 'failed').eq('failure_kind', 'manual_review').order('updated_at', { ascending: false }).limit(10);
  if (rows.error || rows.count == null) throw Error('人工复核清单读取失败');
  if (rows.count > 0) notices.push({ queue: 'score', kind: 'manual-summary',
    message: `待人工复核 ${rows.count} 单，最近十个订单：${rows.data?.map(row => row.id).join('、')}` });
}
