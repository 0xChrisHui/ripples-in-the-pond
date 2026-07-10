import { supabaseAdmin } from '@/src/lib/supabase';
import { sendAlert } from '@/src/lib/alerts/resend';

/**
 * mint_queue 状态机的写库辅助函数（从 steps.ts 拆出，P10-B P1-4 让位）：
 *   markFailed     — Phase 6 A2：标 failed 时必须带 failure_kind（safe_retry / manual_review）
 *   markSuccess    — 先写 mint_events 再 CAS 推进 status（防并发/丢资产）
 *   resetToPending — 仅在"链上未发"或"链上 revert"这种安全场景下调用
 */

export const MAX_RETRY = 3;

export type FailureKind = 'safe_retry' | 'manual_review';

/**
 * 标记 failed 必须显式给出 failure_kind：
 * - safe_retry  → API 收到再次请求时可自动 reset 为 pending 重试
 * - manual_review → API 返 409 needsReview，ops 介入
 */
export async function markFailed(
  jobId: string,
  kind: FailureKind,
  errorMsg: string,
): Promise<void> {
  await supabaseAdmin
    .from('mint_queue')
    .update({
      status: 'failed',
      failure_kind: kind,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  console.error(`[mint-queue] markFailed ${kind} job=${jobId}: ${errorMsg}`);

  // P2-4：manual_review 不可自动恢复 → 发邮件告警（对齐 score 队列；未配 env 静默 log）
  if (kind === 'manual_review') {
    void sendAlert({
      subject: 'mint_queue manual_review',
      body: [`jobId: ${jobId}`, `error: ${errorMsg}`].join('\n'),
    });
  }
}

export async function markSuccess(
  jobId: string, userId: string, tokenId: number, txHash: string,
) {
  const { data: track } = await supabaseAdmin
    .from('tracks')
    .select('id')
    .eq('week', tokenId)
    .single();

  if (!track) {
    await markFailed(
      jobId,
      'manual_review',
      `track not found for week=${tokenId} — 需要补 track 数据`,
    );
    return;
  }

  // 1. 先写永久记录（UNIQUE(mint_queue_id) 保证 upsert 幂等）
  const { error: eventErr } = await supabaseAdmin.from('mint_events').upsert(
    {
      mint_queue_id: jobId,
      user_id: userId,
      track_id: track.id,
      token_id: tokenId,
      tx_hash: txHash,
    },
    { onConflict: 'mint_queue_id' },
  );

  if (eventErr) {
    // mint_events 未落盘 — 保持 minting_onchain，下次 cron 查 receipt 会再进 markSuccess
    console.error(
      `[mint-queue] mint_events 写入失败 job=${jobId}: ${eventErr.message}，保持 minting_onchain 待下次重试`,
    );
    throw new Error(`mint_events write failed: ${eventErr.message}`);
  }

  // 2. 永久记录已落盘后才推进状态（CAS 防并发重复标 success）
  await supabaseAdmin
    .from('mint_queue')
    .update({ status: 'success', updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'minting_onchain');
}

/** retry 未耗尽 → reset 为 pending；已耗尽 → markFailed(safe_retry) */
export async function resetToPending(jobId: string, retryCount: number) {
  if (retryCount + 1 >= MAX_RETRY) {
    await markFailed(
      jobId,
      'safe_retry',
      `retry exhausted (${retryCount + 1}/${MAX_RETRY})`,
    );
    return;
  }
  await supabaseAdmin
    .from('mint_queue')
    .update({
      status: 'pending',
      tx_hash: null,
      retry_count: retryCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}
