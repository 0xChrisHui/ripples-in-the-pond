import { randomUUID } from 'node:crypto';
import { acquireOpLock, heartbeatOpLock, releaseOpLock } from '@/src/lib/chain/operator-lock';
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
  /** 调用方已持有运营钱包锁时传入其 holder；否则本函数自己加锁 */
  lockHolder?: string;
};

/** 对账（只读链）+ 意图转订单 + OP 代付发送。发送与 Score / 素材 / Pond Echo 共用全局串行锁。 */
export async function runScorePackCycle({ batch, lockHolder }: CycleOptions): Promise<Record<string, unknown>> {
  const summary: Record<string, number> = {};
  const bump = (key: string) => { summary[key] = (summary[key] ?? 0) + 1; };
  const intents = await promoteOpIntents(batch);
  const active = await load(['awaiting_wallet', 'unsent', 'submitted_unknown', 'confirming', 'queued'], batch);
  for (const order of active) bump(await reconcileOrder(order).catch(() => 'failed'));

  const now = new Date().toISOString();
  const queued = await load(['queued'], batch, (q) => q.or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .eq('mode', 'op_sponsored'));
  if (queued.length > 0) {
    const worker = lockHolder ?? `score-pack:${randomUUID()}`;
    const acquired = lockHolder ? true : await acquireOpLock(worker);
    if (!acquired) {
      bump('lock_busy');
    } else {
      try {
        for (const order of queued) {
          if (!await heartbeatOpLock(worker)) break; // 续期失败立即停止后续广播
          bump(await sendSponsoredOrder(order, worker));
        }
      } finally {
        if (!lockHolder) await releaseOpLock(worker);
      }
    }
  }
  return { intents, ...summary };
}
