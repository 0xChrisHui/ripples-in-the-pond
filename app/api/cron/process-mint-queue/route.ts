import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import {
  operatorWalletClient,
  publicClient,
} from '@/src/lib/chain/operator-wallet';
import {
  MATERIAL_NFT_ADDRESS,
  MATERIAL_NFT_ABI,
} from '@/src/lib/chain/contracts';

/**
 * GET /api/cron/process-mint-queue
 * 素材 NFT 铸造 — 两步状态机，每步 < 5 秒：
 *   第 1 次 cron：pending → minting_onchain（发交易 + 存 tx_hash）
 *   第 2 次 cron：minting_onchain → success（查 receipt + 写 mint_events）
 *
 * 每次调用优先完成 minting_onchain，再抢新 pending。
 * 一次只处理一条（nonce 串行要求）。
 */

const MAX_RETRY = 3;
// minting_onchain 无 tx_hash 超过 3 分钟视为卡住
const STUCK_TIMEOUT_MS = 3 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronSecret(req)) {
      return NextResponse.json({ error: '无效的 secret' }, { status: 401 });
    }

    // 步骤 1：优先完成已发交易的 minting_onchain
    const confirmed = await tryConfirmMinting();
    if (confirmed) return NextResponse.json(confirmed);

    // 步骤 2：抢新 pending → 发交易 → 存 tx_hash → 返回（不等确认）
    const sent = await trySendNew();
    if (sent) return NextResponse.json(sent);

    return NextResponse.json({ result: 'idle', processed: 0 });
  } catch (err) {
    console.error('[mint-queue] error:', err);
    return NextResponse.json(
      { error: '处理失败' },
      { status: 500 },
    );
  }
}

/**
 * 查 minting_onchain 记录：
 * - 有 tx_hash → 查链上 receipt → 完成或回退
 * - 无 tx_hash + 超时 → 回退 pending 重试
 */
async function tryConfirmMinting() {
  const { data: job } = await supabaseAdmin
    .from('mint_queue')
    .select('id, user_id, token_id, tx_hash, retry_count, updated_at')
    .eq('status', 'minting_onchain')
    .order('updated_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!job) return null;

  // 无 tx_hash + 超时 → 回退 pending（链上没发过，安全重试）
  if (!job.tx_hash) {
    const age = Date.now() - new Date(job.updated_at).getTime();
    if (age > STUCK_TIMEOUT_MS) {
      await resetToPending(job.id, job.retry_count);
      return { result: 'recovered', jobId: job.id };
    }
    return null; // 还在发送中，等下次
  }

  // 有 tx_hash → 查链上结果
  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: job.tx_hash as `0x${string}`,
    });

    if (receipt.status === 'success') {
      await markSuccess(job.id, job.user_id, job.token_id, job.tx_hash);
      return { result: 'confirmed', jobId: job.id, txHash: job.tx_hash };
    }
    // 链上失败 → 回退重试
    await resetToPending(job.id, job.retry_count);
    return { result: 'chain_failed', jobId: job.id };
  } catch {
    // receipt 还没出来（pending tx）→ 等下次
    return null;
  }
}

/** 抢一条 pending → 发交易 → 立刻存 tx_hash → 返回 */
async function trySendNew() {
  const { data: jobs, error } = await supabaseAdmin.rpc('claim_pending_job');
  if (error || !jobs || jobs.length === 0) return null;

  const job = jobs[0];

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('evm_address')
    .eq('id', job.user_id)
    .single();

  if (!user) {
    await supabaseAdmin
      .from('mint_queue')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', job.id);
    return { result: 'no_user', jobId: job.id };
  }

  try {
    const txHash = await operatorWalletClient.writeContract({
      address: MATERIAL_NFT_ADDRESS,
      abi: MATERIAL_NFT_ABI,
      functionName: 'mint',
      args: [
        user.evm_address as `0x${string}`,
        BigInt(job.token_id),
        1n,
        '0x',
      ],
    });

    // 立刻存 tx_hash — 不等确认，下次 cron 来查结果
    await supabaseAdmin
      .from('mint_queue')
      .update({ tx_hash: txHash, updated_at: new Date().toISOString() })
      .eq('id', job.id);

    return { result: 'sent', jobId: job.id, txHash };
  } catch (err) {
    console.error('[mint-queue] send failed:', err);
    await resetToPending(job.id, job.retry_count);
    return { result: 'send_failed', jobId: job.id };
  }
}

async function markSuccess(
  jobId: string, userId: string, tokenId: number, txHash: string,
) {
  await supabaseAdmin
    .from('mint_queue')
    .update({ status: 'success', updated_at: new Date().toISOString() })
    .eq('id', jobId);

  const { data: track } = await supabaseAdmin
    .from('tracks')
    .select('id')
    .eq('week', tokenId)
    .single();

  if (track) {
    await supabaseAdmin.from('mint_events').insert({
      mint_queue_id: jobId,
      user_id: userId,
      track_id: track.id,
      token_id: tokenId,
      tx_hash: txHash,
    });
  }
}

async function resetToPending(jobId: string, retryCount: number) {
  const newStatus = retryCount + 1 >= MAX_RETRY ? 'failed' : 'pending';
  await supabaseAdmin
    .from('mint_queue')
    .update({
      status: newStatus,
      tx_hash: null,
      retry_count: retryCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}
