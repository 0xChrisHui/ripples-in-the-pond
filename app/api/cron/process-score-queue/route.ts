import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { boundedInt, serialSender } from '@/src/lib/cron/batch';
import { runScoreCycle } from '@/src/lib/cron/score-cycle';
import { supabaseAdmin } from '@/src/lib/supabase';
import { processOrder } from './process-order';
import type { ScoreMintQueueRow, ScoreMintStatus } from '@/src/types/jam';
import { stepUploadEvents, stepUploadMetadata } from './steps-upload';
import { stepPreparePackage } from './steps-package';
import { stepMintOnchain } from './steps-mint';
import { stepSetTokenUri } from './steps-set-uri';
import { stepFinalizeSnapshot } from './steps-finalize';

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return NextResponse.json({ error: '无效的 secret' }, { status: 401 });
  const start = Date.now();
  const deadline = start + 25_000;
  // 同一分钟重叠触发时，只允许第一个请求写入该分钟心跳。
  const minute = new Date(Math.floor(start / 60_000) * 60_000).toISOString();
  const entry = { key: 'score-queue:last-run', value: minute, updated_at: minute };
  const heartbeat = await supabaseAdmin.from('system_kv').update(entry)
    .eq('key', entry.key).lt('updated_at', minute).select('key');
  if (!heartbeat.error && !heartbeat.data?.length) {
    const seed = await supabaseAdmin.from('system_kv').upsert(entry, { onConflict: 'key', ignoreDuplicates: true });
    if (seed.error) console.error('[score-cron] 心跳未写入', seed.error.message);
  } else if (heartbeat.error) console.error('[score-cron] 心跳失败', heartbeat.error.message);
  const send = serialSender();
  const { results, claimFailed } = await runScoreCycle({
    limit: boundedInt(process.env.SCORE_QUEUE_BATCH, 5, 10),
    concurrency: boundedInt(process.env.SCORE_QUEUE_CONCURRENCY, 3, 10),
    claimUntil: start + 20_000,
    deadline,
    claim: async () => {
      const leaseOwner = randomUUID();
      const { data, error } = await supabaseAdmin.rpc('claim_score_queue_job', {
        p_owner: leaseOwner, p_lease_minutes: 5,
      });
      if (error) throw error;
      return data?.length ? { row: data[0] as ScoreMintQueueRow, leaseOwner } : null;
    },
    step: ({ row, leaseOwner }) => processOrder(row, leaseOwner, async (): Promise<ScoreMintStatus> => {
      // 路由到对应 step（所有 step 内部 update 都带 owner CAS）
      switch (row.status) {
        case 'pending':
        case 'uploading_events':
          return stepUploadEvents(row, leaseOwner);
        case 'preparing_package':
          return stepPreparePackage(row, leaseOwner);
        case 'minting_onchain':
          return send(() => stepMintOnchain(row, leaseOwner, deadline));
        case 'uploading_metadata':
          return stepUploadMetadata(row, leaseOwner);
        case 'setting_uri':
          return send(() => stepSetTokenUri(row, leaseOwner, deadline));
        case 'finalizing_snapshot':
          return stepFinalizeSnapshot(row, leaseOwner);
        default:
          throw new Error(`unexpected status: ${row.status}`);
      }
  
    }, true),
    reload: async ({ row, leaseOwner }) => {
      const { data, error } = await supabaseAdmin.from('score_nft_queue').select('*')
        .eq('id', row.id).eq('locked_by', leaseOwner)
        .gt('lease_expires_at', new Date().toISOString()).maybeSingle();
      if (error) throw error;
      return data as ScoreMintQueueRow | null;
    },
    release: async ({ row, leaseOwner }) => {
      // 等待传播已清除 owner 并设置退避，不能覆盖它，也不能释放新领取者的锁。
      const { error } = await supabaseAdmin.from('score_nft_queue')
        .update({ locked_by: null, lease_expires_at: null })
        .eq('id', row.id).eq('locked_by', leaseOwner)
        .gt('lease_expires_at', new Date().toISOString());
      if (error) throw error;
    },
  });
  const failed = claimFailed || results.some(item => item.status === 'rejected');
  return NextResponse.json({ result: failed ? 'error' : 'ok', processed: results.length,
    issuance: { protocol: 'atomic-v1', issuer: process.env.ATOMIC_SCORE_ISSUER_ADDRESS ?? null },
    orders: results.map(item => item.status === 'fulfilled' ? item.value : { result: 'error' }),
  }, { status: failed ? 500 : 200 });
}
