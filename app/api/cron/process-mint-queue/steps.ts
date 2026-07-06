import { supabaseAdmin } from '@/src/lib/supabase';
import {
  operatorWalletClient,
  publicClient,
} from '@/src/lib/chain/operator-wallet';
import {
  MATERIAL_NFT_ADDRESS,
  MATERIAL_NFT_ABI,
} from '@/src/lib/chain/contracts';
import { markFailed, markSuccess, resetToPending } from './steps-helpers';

/**
 * 素材 NFT 铸造的状态机 steps（写库辅助函数见 steps-helpers.ts）：
 *   tryConfirmMinting  — 查已发 tx 的 receipt，推进或回退
 *   trySendNew         — 抢 pending + 发 tx + 存 hash（严格区分链上 vs DB 失败）
 */

// minting_onchain 无 tx_hash 超过 3 分钟视为卡住
const STUCK_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * 查 minting_onchain 记录：
 * - 有 tx_hash → 查链上 receipt → 完成或回退
 * - 无 tx_hash + 超时 → markFailed(manual_review)（链上状态未知，不能 reset）
 */
export async function tryConfirmMinting() {
  const { data: job } = await supabaseAdmin
    .from('mint_queue')
    .select('id, user_id, token_id, tx_hash, retry_count, updated_at')
    .eq('status', 'minting_onchain')
    .order('updated_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!job) return null;

  if (!job.tx_hash) {
    const age = Date.now() - new Date(job.updated_at).getTime();
    if (age > STUCK_TIMEOUT_MS) {
      await markFailed(
        job.id,
        'manual_review',
        `stuck in minting_onchain without tx_hash for ${age}ms — chain state unknown, check operator wallet history`,
      );
      return { result: 'stuck_needs_review', jobId: job.id };
    }
    return null; // 正在发送中，等下次
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
    // 链上 revert → 安全回退重试（tx 已结束，重新跑不会双重 mint）
    await resetToPending(job.id, job.retry_count);
    return { result: 'chain_failed', jobId: job.id };
  } catch {
    // receipt 还没出来（pending tx）→ 等下次
    return null;
  }
}

/** 抢一条 pending → 发交易 → 立刻存 tx_hash → 返回 */
export async function trySendNew() {
  const { data: jobs, error } = await supabaseAdmin.rpc('claim_pending_job');
  if (error || !jobs || jobs.length === 0) return null;

  const job = jobs[0];

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('evm_address')
    .eq('id', job.user_id)
    .single();

  if (!user) {
    await markFailed(job.id, 'manual_review', `user not found: ${job.user_id}`);
    return { result: 'no_user', jobId: job.id };
  }

  // P1-3 双发防御：发 tx 前盖 mint_attempted_at 戳（见下方 catch）
  const stampIso = new Date().toISOString();
  await supabaseAdmin
    .from('mint_queue')
    .update({ mint_attempted_at: stampIso, updated_at: stampIso })
    .eq('id', job.id);

  let txHash: `0x${string}`;
  try {
    txHash = await operatorWalletClient.writeContract({
      address: MATERIAL_NFT_ADDRESS,
      abi: MATERIAL_NFT_ABI,
      functionName: 'mint',
      args: [user.evm_address as `0x${string}`, BigInt(job.token_id), 1n, '0x'],
    });
  } catch (err) {
    // ⚠ P1-3：不 resetToPending（RPC 超时 tx 可能已广播 → 会双铸），留 minting_onchain 交时间窗
    console.error('[mint-queue] chain send failed, left in minting_onchain:', err);
    return { result: 'send_failed', jobId: job.id };
  }

  // tx 已广播 — 下面任何失败都不能 resetToPending（否则重复 mint）
  const { error: dbErr } = await supabaseAdmin
    .from('mint_queue')
    .update({ tx_hash: txHash, updated_at: new Date().toISOString() })
    .eq('id', job.id);

  if (dbErr) {
    console.error(
      `[mint-queue] CRITICAL: tx ${txHash} 已上链但 DB 写 tx_hash 失败 job=${job.id}: ${dbErr.message}. 人工核查: UPDATE mint_queue SET tx_hash='${txHash}' WHERE id='${job.id}'`,
    );
    // 保持 minting_onchain + tx_hash=null，STUCK_TIMEOUT_MS 后会被 markFailed(manual_review)
    return { result: 'db_write_failed', jobId: job.id, txHash };
  }

  return { result: 'sent', jobId: job.id, txHash };
}
