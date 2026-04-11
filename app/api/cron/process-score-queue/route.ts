import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { ScoreMintQueueRow, ScoreMintStatus } from '@/src/types/jam';
import { stepUploadEvents, stepUploadMetadata } from './steps-upload';
import { stepMintOnchain, stepSetTokenUri } from './steps-chain';

/**
 * GET /api/cron/process-score-queue?secret=xxx
 *
 * Phase 3 S5.b — 5 步状态机 cron，每次处理一条：
 *   pending → uploading_events → minting_onchain →
 *   uploading_metadata → setting_uri → success
 *
 * 每一步独立。失败时 retry_count++ + last_error 记录 + status 不变
 * （除非耗尽 MAX_RETRY），下次 cron 从断点续跑。
 *
 * 幂等策略（playbook 硬门槛）：
 * - minting_onchain：进入前 tx_hash 存在 → 跳过重发，直接走 receipt 回查
 *                    tx_hash 不存在 → 发送并立刻回写 DB
 * - setting_uri：setTokenURI 幂等，可重复写入同 URI 无副作用
 * - uploading_events/metadata：Arweave 内容寻址，同内容重传得到同 txid
 */

const MAX_RETRY = 3;

const CRON_ACTIONABLE_STATUSES: ScoreMintStatus[] = [
  'pending',
  'uploading_events',
  'minting_onchain',
  'uploading_metadata',
  'setting_uri',
];

export async function GET(req: NextRequest) {
  let claimedId: string | null = null;
  let claimedRetry = 0;

  try {
    // 1. 验证 secret
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: '无效的 secret' }, { status: 401 });
    }

    // 2. 抢单：按 created_at ASC 拿最老的一条可处理任务
    const { data: rows, error: queryErr } = await supabaseAdmin
      .from('score_nft_queue')
      .select('*')
      .in('status', CRON_ACTIONABLE_STATUSES)
      .order('created_at', { ascending: true })
      .limit(1);

    if (queryErr) throw queryErr;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ result: 'ok', processed: 0 });
    }

    const row = rows[0] as ScoreMintQueueRow;
    claimedId = row.id;
    claimedRetry = row.retry_count;

    console.log(`[score-cron] picked ${row.id} status=${row.status}`);

    // 3. 根据 status 路由到对应 step 函数
    let newStatus: ScoreMintStatus;
    switch (row.status) {
      case 'pending':
      case 'uploading_events':
        newStatus = await stepUploadEvents(row);
        break;
      case 'minting_onchain':
        newStatus = await stepMintOnchain(row);
        break;
      case 'uploading_metadata':
        newStatus = await stepUploadMetadata(row);
        break;
      case 'setting_uri':
        newStatus = await stepSetTokenUri(row);
        break;
      default:
        throw new Error(`unexpected status: ${row.status}`);
    }

    // 4. 推进 status
    await supabaseAdmin
      .from('score_nft_queue')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', claimedId);

    return NextResponse.json({
      result: 'ok',
      processed: 1,
      queueId: claimedId,
      status: newStatus,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[score-cron] error:', msg);

    // 失败降级：retry_count++，耗尽时 → failed，否则保持当前 status 等下次续跑
    if (claimedId) {
      const shouldFail = claimedRetry + 1 >= MAX_RETRY;
      await supabaseAdmin
        .from('score_nft_queue')
        .update({
          ...(shouldFail ? { status: 'failed' as const } : {}),
          retry_count: claimedRetry + 1,
          last_error: msg.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimedId);
    }

    return NextResponse.json(
      { error: '处理失败', message: msg },
      { status: 500 },
    );
  }
}
