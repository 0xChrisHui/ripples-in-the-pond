import { randomUUID } from 'node:crypto';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { acquireOpLock, heartbeatOpLock, releaseOpLock } from '@/src/lib/chain/operator-lock';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { PackOrderRow } from '@/src/lib/score-pack/orders';
import { promoteOpIntents } from './intents';
import { reconcileOrder, sendSponsoredOrder } from './steps';

export const runtime = 'nodejs';
const BATCH = 5;

async function load(statuses: string[], extra?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) {
  const q = extra ? extra(base(statuses)) : base(statuses);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PackOrderRow[];
}
function base(statuses: string[]) {
  return supabaseAdmin.from('score_pack_orders').select('*').in('status', statuses)
    .order('created_at').limit(BATCH);
}

/** 对账（只读链，无需 operator 锁）+ OP 发送（与 Score / 素材 / Pond Echo 共用全局串行锁）。 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return Response.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  const summary: Record<string, number> = {};
  const bump = (key: string) => { summary[key] = (summary[key] ?? 0) + 1; };
  try {
    const intents = await promoteOpIntents();
    const active = await load(['awaiting_wallet', 'unsent', 'submitted_unknown', 'confirming', 'queued']);
    for (const order of active) bump(await reconcileOrder(order).catch(() => 'failed'));

    const now = new Date().toISOString();
    const queued = await load(['queued'], (q) => q.or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
      .eq('mode', 'op_sponsored'));
    if (queued.length > 0) {
      const worker = `score-pack:${randomUUID()}`;
      if (await acquireOpLock(worker)) {
        try {
          for (const order of queued) {
            if (!await heartbeatOpLock(worker)) break; // 续期失败立即停止后续广播
            bump(await sendSponsoredOrder(order, worker));
          }
        } finally {
          await releaseOpLock(worker);
        }
      } else {
        bump('lock_busy');
      }
    }
    return Response.json({ intents, ...summary }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[score-pack-cron]', error instanceof Error ? error.message : error);
    return Response.json({ code: 'SCORE_PACK_CRON_FAILED', ...summary }, { status: 503 });
  }
}
