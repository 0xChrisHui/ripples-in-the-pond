import { randomUUID } from 'node:crypto';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { SelfMintOrderRow } from '@/src/lib/self-mint/order';
import { inspectSelfMintOrder } from '@/src/lib/self-mint/reconcile';
import { publishSelfMintSnapshot } from '@/src/lib/self-mint/snapshot';

function releaseLease() {
  return { locked_by: null, lease_expires_at: null, updated_at: new Date().toISOString() };
}

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
    const inspected = await inspectSelfMintOrder(row);
    if (inspected.state === 'success') {
      await publishSelfMintSnapshot(row);
      const { error: completeError } = await supabaseAdmin.rpc('complete_score_self_mint', {
        p_order_id: row.order_id,
        p_token_id: row.token_id,
        p_tx_hash: inspected.txHash,
        p_block_number: Number(inspected.blockNumber),
      });
      if (completeError) throw completeError;
      return Response.json({ result: 'ok', processed: 1, status: 'success' });
    }
    if (inspected.state === 'reverted') {
      await supabaseAdmin.from('score_self_mint_orders').update({
        failed_tx_hash: inspected.txHash,
        tx_hash: null,
        send_attempted_at: null,
        status: 'failed',
        release_verified_at: new Date().toISOString(),
        failure_stage: 'onchain',
        failure_code: 'TX_REVERTED',
        retryable: true,
        last_error: '交易已在链上明确回滚',
        ...releaseLease(),
      }).eq('id', row.id).eq('locked_by', owner);
      return Response.json({ result: 'ok', processed: 1, status: 'failed' });
    }
    if (inspected.state === 'uncertain') {
      throw new Error(`交易结果仍未知：${inspected.reason}`);
    }
    const values = inspected.state === 'confirming' ? {
      status: 'confirming',
      replacement_tx_hash: row.tx_hash && row.tx_hash !== inspected.txHash ? inspected.txHash : null,
      block_number: Number(inspected.blockNumber),
    } : {};
    await supabaseAdmin.from('score_self_mint_orders')
      .update({ ...values, ...releaseLease() }).eq('id', row.id).eq('locked_by', owner);
    return Response.json({ result: 'ok', processed: 1, status: inspected.state });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    await supabaseAdmin.from('score_self_mint_orders').update({
      status: 'manual_review',
      failure_stage: 'reconcile',
      failure_code: 'CHAIN_STATE_MISMATCH',
      retryable: false,
      last_error: message.slice(0, 2000),
      ...releaseLease(),
    }).eq('id', row.id).eq('locked_by', owner);
    return Response.json({ error: '对账进入人工复核', code: 'MANUAL_REVIEW' }, { status: 500 });
  }
}
