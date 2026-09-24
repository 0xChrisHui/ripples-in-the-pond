import 'server-only';

import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/src/lib/supabase';
import { processSelfMintAsset } from './assets';
import type { SelfMintOrderRow } from './order';

type JobResult = {
  processed: 0 | 1;
  asset?: 'events' | 'package' | 'metadata';
  status?: 'preparing_assets' | 'ready_to_sign';
};

function releaseLease() {
  return { locked_by: null, lease_expires_at: null, updated_at: new Date().toISOString() };
}

async function saveFailure(row: SelfMintOrderRow, owner: string, caught: unknown): Promise<never> {
  const message = caught instanceof Error ? caught.message : String(caught);
  const retryCount = row.retry_count + 1;
  const resultUnknown = message.includes('CRITICAL') || message.includes('结果未知');
  const exhausted = !resultUnknown && retryCount >= 5;
  const manualReview = resultUnknown || exhausted;
  await supabaseAdmin.from('score_self_mint_orders').update({
    status: manualReview ? 'manual_review' : 'preparing_assets',
    failure_stage: 'asset_upload',
    failure_code: resultUnknown ? 'UPLOAD_RESULT_UNKNOWN'
      : exhausted ? 'ASSET_RETRY_EXHAUSTED' : 'ASSET_PREPARE_FAILED',
    retryable: !manualReview,
    retry_count: retryCount,
    last_error: message.slice(0, 2000),
    ...releaseLease(),
  }).eq('id', row.id).eq('locked_by', owner);
  throw caught;
}

async function processClaimed(row: SelfMintOrderRow, owner: string): Promise<JobResult> {
  let current = row;
  try {
    for (let step = 0; step < 3; step += 1) {
      const result = await processSelfMintAsset(current, owner);
      if (!result.verified) {
        await supabaseAdmin.from('score_self_mint_orders').update(releaseLease())
          .eq('id', row.id).eq('locked_by', owner);
        return { processed: 1, asset: result.kind, status: 'preparing_assets' };
      }
      if (result.kind === 'metadata') {
        const saved = await supabaseAdmin.from('score_self_mint_orders').update({
          status: 'ready_to_sign', failure_stage: null, failure_code: null,
          retryable: false, last_error: null, ...releaseLease(),
        }).eq('id', row.id).eq('locked_by', owner).select('id').maybeSingle();
        if (!saved.data) throw new Error('资产任务 lease 已丢失');
        return { processed: 1, asset: result.kind, status: 'ready_to_sign' };
      }
      const refreshed = await supabaseAdmin.from('score_self_mint_orders')
        .select('*').eq('id', row.id).eq('locked_by', owner).single();
      if (refreshed.error || !refreshed.data) throw new Error('资产任务读取失败');
      current = refreshed.data as SelfMintOrderRow;
    }
    throw new Error('资产任务没有收敛到 metadata');
  } catch (error) {
    return saveFailure(current, owner, error);
  }
}

export async function runNextSelfMintAssetJob(): Promise<JobResult> {
  const owner = randomUUID();
  const { data, error } = await supabaseAdmin.rpc('claim_score_self_mint_asset_job', {
    p_owner: owner, p_lease_minutes: 5,
  });
  if (error) throw new Error('资产任务领取失败');
  const row = (Array.isArray(data) ? data[0] : data) as SelfMintOrderRow | undefined;
  return row ? processClaimed(row, owner) : { processed: 0 };
}

export async function runSelfMintAssetOrder(orderId: string): Promise<JobResult> {
  let result: JobResult = { processed: 0 };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const owner = randomUUID();
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 5 * 60_000).toISOString();
    const claimed = await supabaseAdmin.from('score_self_mint_orders').update({
      locked_by: owner, lease_expires_at: leaseUntil, updated_at: now.toISOString(),
    }).eq('order_id', orderId).eq('status', 'preparing_assets')
      .or(`lease_expires_at.is.null,lease_expires_at.lt.${now.toISOString()}`)
      .select('*').maybeSingle();
    if (claimed.error) throw claimed.error;
    if (!claimed.data) return result;
    result = await processClaimed(claimed.data as SelfMintOrderRow, owner);
    if (result.status === 'ready_to_sign') return result;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return result;
}
