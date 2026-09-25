import 'server-only';

import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { SelfMintOrderRow } from '../order';
import { inspectSelfMintOrder } from '../reconcile';
import { publishSelfMintSnapshot } from '../snapshot';

function releaseLease() {
  return { locked_by: null, lease_expires_at: null, updated_at: new Date().toISOString() };
}

export async function settleClaimedSelfMintOrder(row: SelfMintOrderRow, owner: string) {
  try {
    const inspected = await inspectSelfMintOrder(row);
    if (inspected.state === 'success') {
      await publishSelfMintSnapshot(row);
      const { error } = await supabaseAdmin.rpc('complete_score_self_mint', {
        p_order_id: row.order_id,
        p_token_id: row.token_id,
        p_tx_hash: inspected.txHash,
        p_block_number: Number(inspected.blockNumber),
      });
      if (error) throw error;
      return { processed: 1, status: 'success' as const };
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
      return { processed: 1, status: 'failed' as const };
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
    return { processed: 1, status: inspected.state };
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
    throw caught;
  }
}

export async function reconcileSelfMintOrder(orderId: string, userId: string) {
  const owner = randomUUID();
  const now = new Date();
  const { data, error } = await supabaseAdmin.from('score_self_mint_orders').update({
    locked_by: owner,
    lease_expires_at: new Date(now.getTime() + 5 * 60_000).toISOString(),
    last_reconciled_at: now.toISOString(),
    updated_at: now.toISOString(),
  }).eq('order_id', orderId).eq('user_id', userId)
    .in('status', ['submitted', 'confirming', 'manual_review'])
    .or(`lease_expires_at.is.null,lease_expires_at.lt.${now.toISOString()}`)
    .select('*').maybeSingle();
  if (error) throw error;
  if (!data) return { processed: 0, status: 'busy' as const };
  return settleClaimedSelfMintOrder(data as SelfMintOrderRow, owner);
}
