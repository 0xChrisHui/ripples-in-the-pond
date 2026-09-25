import { randomUUID } from 'node:crypto';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { SelfMintOrderRow } from '@/src/lib/self-mint/order';
import { settleClaimedSelfMintOrder } from '@/src/lib/self-mint/server/reconcile-job';

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return Response.json({ error: '无效的 secret' }, { status: 401 });
  const owner = randomUUID();
  const { data, error } = await supabaseAdmin.rpc('claim_score_self_mint_reconcile_job', {
    p_owner: owner, p_lease_minutes: 5,
  });
  if (error) return Response.json({ error: '对账任务领取失败' }, { status: 500 });
  const row = (Array.isArray(data) ? data[0] : data) as SelfMintOrderRow | undefined;
  if (!row) return Response.json({ result: 'ok', processed: 0 });
  try {
    const result = await settleClaimedSelfMintOrder(row, owner);
    return Response.json({ result: 'ok', ...result });
  } catch {
    return Response.json({ error: '对账进入人工复核', code: 'MANUAL_REVIEW' }, { status: 500 });
  }
}
