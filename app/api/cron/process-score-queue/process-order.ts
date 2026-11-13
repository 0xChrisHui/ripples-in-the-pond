import { supabaseAdmin } from '@/src/lib/supabase';
import { notifyOnce } from '@/src/lib/alerts/once';
import { PermanentResourcePendingError, scoreQueueErrorDecision } from '@/src/lib/permanent-core/permanent-wait';
import type { ScoreMintQueueRow, ScoreMintStatus } from '@/src/types/jam';

export async function processOrder(claimedRow: ScoreMintQueueRow, leaseOwner: string,
  step: () => Promise<ScoreMintStatus>) {
  const claimedId = claimedRow.id;
  let newStatus: ScoreMintStatus;
  try {
    newStatus = await step();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[score-cron] error:', msg);

    let uploadStartedAt: string | null = null;
    if (err instanceof PermanentResourcePendingError && err.arTxIds.length) {
      try {
        // 老订单的新资源需要独立传播窗口，不能让旧 events 的时间提前耗尽它。
        const { data, error } = await supabaseAdmin.from('score_arweave_upload_ledger')
          .select('attempted_at').eq('queue_id', claimedId).in('arweave_tx_id', err.arTxIds)
          .order('attempted_at', { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        uploadStartedAt = data?.attempted_at ?? null;
      } catch (error) {
        console.error('[score-cron] 上传账本读取失败，回退订单创建时间:', error);
      }
    }
    const { waiting, update } = scoreQueueErrorDecision(err, claimedRow, Date.now(), uploadStartedAt);

    let errorUpdate = supabaseAdmin
      .from('score_nft_queue')
      .update(update)
      .eq('id', claimedId)
      .eq('locked_by', leaseOwner);

    // 等待只由仍持有有效 lease 的 worker 写入，且写入成功才向调用方报告等待。
    errorUpdate = errorUpdate.gt('lease_expires_at', update.updated_at!);
    const { data: errorUpdated, error: updateError } = await errorUpdate.select('id');
    if (updateError || !errorUpdated?.length) throw Error('订单错误状态未写入');
    if (waiting) {
      return { result: 'waiting', queueId: claimedId };
    }
    if (update.failure_kind === 'manual_review') {
      await notifyOnce('score', 'manual-first', 'Score 订单需人工复核', claimedId, 900);
    }
    throw Error(msg);
  }
  // 只有已完成步骤的有效领取者能推进并释放订单。
  const nowIso = new Date().toISOString();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('score_nft_queue')
    .update({
      status: newStatus,
      updated_at: nowIso,
      last_error: null,
      locked_by: null,
      lease_expires_at: null,
    })
    .eq('id', claimedId)
    .eq('locked_by', leaseOwner)
    .gt('lease_expires_at', nowIso)
    .select('id');

  if (updateError || !updated?.length) {
    throw Error(`[score-cron] CAS failed: ${claimedId} lease lost (worker stale)`);
  }

  return { result: 'ok', queueId: claimedId, status: newStatus };
}
