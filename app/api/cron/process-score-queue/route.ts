import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { acquireOpLock, releaseOpLock } from '@/src/lib/chain/operator-lock';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { ScoreMintQueueRow, ScoreMintStatus } from '@/src/types/jam';
import { stepUploadEvents, stepUploadMetadata } from './steps-upload';
import { stepMintOnchain } from './steps-mint';
import { stepSetTokenUri } from './steps-set-uri';

/**
 * GET /api/cron/process-score-queue?secret=xxx
 *
 * Phase 3 S5.b — 5 步状态机 cron，每次处理一条：
 *   pending → uploading_events → minting_onchain →
 *   uploading_metadata → setting_uri → success
 *
 * Phase 6 A0：入口拿运营钱包全局锁（防 nonce race）
 * Phase 6 A1：每次 claim 分配 leaseOwner，所有 update 必须 CAS owner + 未过期
 *             终态（success / failed）清 lease；catch 失败也清 lease 让其他 cron 接管
 *
 * 幂等核心：
 *   - 上传步骤：Arweave 内容寻址，同内容重传得到同 txid
 *   - mint / setTokenURI：tx_hash / uri_tx_hash 立刻入库，崩溃重启不重发
 *   - "CRITICAL: ..." 错误（chain 已发但 DB 失败）→ 直接 failed 不 retry
 */

const MAX_RETRY = 3;

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: '无效的 secret' }, { status: 401 });
  }

  const opHolder = `score-queue-${randomUUID()}`;
  if (!(await acquireOpLock(opHolder))) {
    return NextResponse.json({ result: 'busy', processed: 0 });
  }

  let claimedId: string | null = null;
  let claimedRetry = 0;
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

    console.log(`[score-cron] picked ${row.id} status=${row.status} lease=${leaseOwner}`);

    // 路由到对应 step（所有 step 内部 update 都带 owner CAS）
    let newStatus: ScoreMintStatus;
    switch (row.status) {
      case 'pending':
      case 'uploading_events':
        newStatus = await stepUploadEvents(row, leaseOwner);
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
      default:
        throw new Error(`unexpected status: ${row.status}`);
    }

    // 推进 status：CAS 校验 (status 未变 + 仍是我 + lease 未过期)，终态清 lease
    const isFinal = newStatus === 'success' || newStatus === 'failed';
    const nowIso = new Date().toISOString();
    const { data: updated } = await supabaseAdmin
      .from('score_nft_queue')
      .update({
        status: newStatus,
        updated_at: nowIso,
        last_error: null,
        ...(isFinal
          ? { locked_by: null, lease_expires_at: null }
          : {}),
      })
      .eq('id', claimedId)
      .eq('status', row.status)
      .eq('locked_by', leaseOwner)
      .gt('lease_expires_at', nowIso)
      .select('id');

    if (!updated || updated.length === 0) {
      console.warn(`[score-cron] CAS failed: ${claimedId} lease lost or status changed by stale worker`);
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

    // 失败处理：CRITICAL 直接 failed 不 retry（chain 已发但 DB 失败的场景）
    // 普通错误 retry_count++，耗尽后 failed；不论何种都释放 lease
    // P1-8 修复（2026-05-08 strict CTO review）：failed 时必须给 failure_kind，
    //   CRITICAL → manual_review（链上状态未知，ops 介入）
    //   retry 耗尽 → safe_retry（已确认链上未发或已 revert，可自动重试）
    if (claimedId) {
      const isCritical = msg.startsWith('CRITICAL');
      const shouldFail = isCritical || claimedRetry + 1 >= MAX_RETRY;
      const failureKind: 'manual_review' | 'safe_retry' | null = shouldFail
        ? (isCritical ? 'manual_review' : 'safe_retry')
        : null;

      await supabaseAdmin
        .from('score_nft_queue')
        .update({
          ...(shouldFail
            ? { status: 'failed' as const, failure_kind: failureKind }
            : {}),
          retry_count: isCritical ? claimedRetry : claimedRetry + 1,
          last_error: msg.slice(0, 500),
          locked_by: null,
          lease_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimedId)
        .eq('locked_by', leaseOwner);
    }

    return NextResponse.json(
      { error: '处理失败', message: msg },
      { status: 500 },
    );
  } finally {
    await releaseOpLock(opHolder);
  }
}
