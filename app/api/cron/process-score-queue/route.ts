import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { acquireOpLock, releaseOpLock, heartbeatOpLock } from '@/src/lib/chain/operator-lock';
import { supabaseAdmin } from '@/src/lib/supabase';
import { sendAlert } from '@/src/lib/alerts/resend';
import type { ScoreMintQueueRow, ScoreMintStatus } from '@/src/types/jam';
import { stepUploadEvents, stepUploadMetadata } from './steps-upload';
import { stepPreparePackage } from './steps-package';
import { stepMintOnchain } from './steps-mint';
import { stepSetTokenUri } from './steps-set-uri';
import { stepFinalizeSnapshot } from './steps-finalize';
import { PermanentResourcePendingError, scoreQueueErrorDecision } from '@/src/lib/permanent-core/permanent-wait';

/**
 * GET /api/cron/process-score-queue?secret=xxx
 *
 * Phase 3 S5.b — 5 步状态机 cron，每次处理一条：
 *   pending → uploading_events → preparing_package → minting_onchain →
 *   uploading_metadata → setting_uri → finalizing_snapshot → success
 *
 * Phase 6 A0：入口拿运营钱包全局锁（防 nonce race）
 * Phase 6 A1：每次 claim 分配 leaseOwner，所有 update 必须 CAS owner + 未过期
 *             终态（success / failed）清 lease；catch 失败也清 lease 让其他 cron 接管
 * Phase 7 A12：route 不再用 row.status 做 CAS（step 不再内部跃迁 status，pending→uploading_events
 *             这种"中间跃迁"全部由本 route 在 step 返回后统一推进；status CAS 反而会导致 race-of-self）
 * Phase 7 A3 ：mint / setTokenURI 入口加 mint_attempted_at / uri_attempted_at 窗口（详见 step 文件）
 *
 * 幂等核心：
 *   - 上传步骤：先写意图、后上传、再双网关验真；结果不明立即转人工核验
 *   - mint / setTokenURI：tx_hash / uri_tx_hash 立刻入库，崩溃重启不重发
 *   - "CRITICAL: ..." 错误（chain 已发但 DB 失败 / mint 卡死窗口超限）→ 直接 failed=manual_review，alert 邮件
 */

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: '无效的 secret' }, { status: 401 });
  }

  const opHolder = `score-queue-${randomUUID()}`;
  if (!(await acquireOpLock(opHolder))) {
    return NextResponse.json({ result: 'busy', processed: 0 });
  }

  // P2-2/A16：Arweave 上传等长步骤可能超 120s lease → 60s 心跳续期，防锁过期后另一 cron 拿锁 nonce race
  const heartbeat = setInterval(() => void heartbeatOpLock(opHolder), 60_000);

  let claimedId: string | null = null;
  let claimedRetry = 0;
  let claimedCreatedAt = '';
  const leaseOwner = randomUUID();

  try {
    // 原子抢单 + 分配 5 分钟 lease
    const { data: rows, error: queryErr } = await supabaseAdmin
      .rpc('claim_score_queue_job', {
        p_owner: leaseOwner,
        p_lease_minutes: 5,
      });

    if (queryErr) throw queryErr;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ result: 'ok', processed: 0 });
    }

    const row = rows[0] as ScoreMintQueueRow;
    claimedId = row.id;
    claimedRetry = row.retry_count;
    claimedCreatedAt = row.created_at;

    console.log(`[score-cron] picked ${row.id} status=${row.status} lease=${leaseOwner}`);

    // 路由到对应 step（所有 step 内部 update 都带 owner CAS）
    let newStatus: ScoreMintStatus;
    switch (row.status) {
      case 'pending':
      case 'uploading_events':
        newStatus = await stepUploadEvents(row, leaseOwner);
        break;
      case 'preparing_package':
        newStatus = await stepPreparePackage(row, leaseOwner);
        break;
      case 'minting_onchain':
        newStatus = await stepMintOnchain(row, leaseOwner);
        break;
      case 'uploading_metadata':
        newStatus = await stepUploadMetadata(row, leaseOwner);
        break;
      case 'setting_uri':
        newStatus = await stepSetTokenUri(row, leaseOwner);
        break;
      case 'finalizing_snapshot':
        newStatus = await stepFinalizeSnapshot(row, leaseOwner);
        break;
      default:
        throw new Error(`unexpected status: ${row.status}`);
    }

    // 推进 status：CAS 只校验 (仍是我 + lease 未过期)
    // A12 修复（2026-05-16）：去掉 `.eq('status', row.status)` —— step 不再内部跃迁 status，
    // pending→uploading_events 这种跃迁也由本 route 统一推；status CAS 反而让"自己 vs 自己"假失败。
    // P2-5 吞吐：每步成功推进后即清 lease（副作用已 CAS 落库，清锁安全），下一 cron 立刻接手，
    //   不必等 5min lease 过期 → 单枚 NFT 全流水线从 ~25min 降到 ~5min。
    const nowIso = new Date().toISOString();
    const { data: updated } = await supabaseAdmin
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

    if (!updated || updated.length === 0) {
      console.warn(`[score-cron] CAS failed: ${claimedId} lease lost (worker stale)`);
    }

    return NextResponse.json({
      result: 'ok',
      processed: 1,
      queueId: claimedId,
      status: newStatus,
      leaseOwner,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[score-cron] error:', msg);

    if (claimedId) {
      let uploadStartedAt: string | null = null;
      if (err instanceof PermanentResourcePendingError) {
        const { data, error } = await supabaseAdmin.from('score_arweave_upload_ledger')
          .select('attempted_at').eq('queue_id', claimedId)
          .order('attempted_at', { ascending: true }).limit(1).maybeSingle();
        if (error) console.error('[score-cron] 上传账本读取失败，回退订单创建时间:', error.message);
        uploadStartedAt = data?.attempted_at ?? null;
      }
      const { waiting, update } = scoreQueueErrorDecision(err, {
        retry_count: claimedRetry, created_at: claimedCreatedAt,
      }, Date.now(), uploadStartedAt);

      let errorUpdate = supabaseAdmin
        .from('score_nft_queue')
        .update(update)
        .eq('id', claimedId)
        .eq('locked_by', leaseOwner);

      // 等待只由仍持有有效 lease 的 worker 写入，且写入成功才向调用方报告等待。
      if (waiting) errorUpdate = errorUpdate.gt('lease_expires_at', update.updated_at!);
      const { data: errorUpdated, error: updateError } = await errorUpdate.select('id');
      if (waiting) {
        if (updateError || !errorUpdated?.length) {
          console.error('[score-cron] 等待状态未写入:', updateError?.message ?? 'lease 已失效');
          return NextResponse.json({ error: '等待状态未写入' }, { status: 500 });
        }
        return NextResponse.json({ result: 'waiting', processed: 1, queueId: claimedId });
      }
      // Phase 7 A8：manual_review 是不可自动恢复的状态，需要人工介入。
      // fire-and-forget 调一次邮件告警；sendAlert 内部自带 try/catch + 未配 env 静默 log。
      if (update.failure_kind === 'manual_review') {
        void sendAlert({
          subject: 'score_nft_queue manual_review',
          body: [
            `queueId: ${claimedId}`,
            `retry_count: ${claimedRetry}`,
            `last_error: ${msg.slice(0, 500)}`,
          ].join('\n'),
        });
      }
    }

    return NextResponse.json(
      { error: '处理失败', message: msg },
      { status: 500 },
    );
  } finally {
    clearInterval(heartbeat);
    await releaseOpLock(opHolder);
  }
}
