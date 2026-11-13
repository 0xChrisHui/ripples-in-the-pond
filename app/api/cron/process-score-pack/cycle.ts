import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { PackOrderRow } from '@/src/lib/score-pack/orders';
import { promoteOpIntents } from './intents';
import { reconcileOrder, sendSponsoredOrder } from './steps';

function load(statuses: string[], batch: number, extra?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) {
  const query = base(statuses, batch);
  return (extra ? extra(query) : query).then(({ data, error }) => {
    if (error) throw error;
    return (data ?? []) as PackOrderRow[];
  });
}
function base(statuses: string[], batch: number) {
  return supabaseAdmin.from('score_pack_orders').select('*').in('status', statuses)
    .order('created_at').limit(batch);
}

export type CycleOptions = {
  /** 每类订单每轮最多处理几单；嵌入每分钟入口时用 1，避免超出函数时限 */
  batch: number;
  /** 本轮绝对截止时间；每次广播都单独检查。 */
  deadline?: number;
};

/** 对账（只读链）+ 意图转订单 + OP 代付发送。发送与 Score / 素材 / Pond Echo 共用全局串行锁。 */
export async function runScorePackCycle({ batch, deadline = Date.now() + 25_000 }: CycleOptions): Promise<Record<string, unknown>> {
  const summary: Record<string, number> = {};
  const bump = (key: string) => { summary[key] = (summary[key] ?? 0) + 1; };
  const intents = await promoteOpIntents(batch);
  const active = await load(['awaiting_wallet', 'unsent', 'submitted_unknown', 'confirming', 'queued'], batch);
  for (const order of active) bump(await reconcileOrder(order).catch(() => 'failed'));

  const now = new Date().toISOString();
  const queued = await load(['queued'], batch, (q) => q.or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .eq('mode', 'op_sponsored'));
  for (const order of queued) {
    if (deadline - Date.now() < 15_000) break;
    bump(await sendSponsoredOrder(order, randomUUID(), deadline));
  }
  return { intents, ...summary };
}
