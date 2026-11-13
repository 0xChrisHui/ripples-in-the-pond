import { guardedWallet } from '@/src/lib/chain/broadcast/guarded-wallet';
import { broadcastOperator } from '@/src/lib/chain/broadcast/operator';
import { supabaseAdmin } from '@/src/lib/supabase';
import {
  operatorWalletClient,
  publicClient,
} from '@/src/lib/chain/operator-wallet';
import {
  ORCHESTRATOR_ADDRESS,
  ORCHESTRATOR_ABI,
} from '@/src/lib/chain/contracts';
import type { ScoreMintQueueRow, ScoreMintStatus } from '@/src/types/jam';
import { extractTokenIdFromLogs } from './_shared';
import { keccak256, stringToHex } from 'viem';

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
// P1-4：有 tx_hash 但 receipt 超 15 分钟不出 → 僵尸 tx，抛 CRITICAL 转 manual_review
const RECEIPT_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Step: minting_onchain → uploading_metadata（Phase 6 A1：拆步 + lease CAS）
 *
 * 没 tx_hash → 发 mintScore tx + 立刻存 hash → 返回 minting_onchain（不等确认）
 * 有 tx_hash → 查 receipt → 抽 tokenId + 推到 uploading_metadata（receipt 未出 → 等下次）
 *
 * "CRITICAL: ..." 错误 = tx 已广播但 DB 写失败（lease 失效），上层 catch 直接 failed 不 retry。
 */
export async function stepMintOnchain(
  row: ScoreMintQueueRow,
  leaseOwner: string,
  deadline: number,
): Promise<ScoreMintStatus> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('evm_address')
    .eq('id', row.user_id)
    .single();
  if (!user) throw new Error(`user not found: ${row.user_id}`);

  const txHash = row.tx_hash as `0x${string}` | null;

  if (!txHash) {
    const attemptedAt = row.mint_attempted_at
      ? new Date(row.mint_attempted_at).getTime()
      : null;
    const nowMs = Date.now();

    if (attemptedAt !== null) {
      if (nowMs - attemptedAt < ATTEMPT_WINDOW_MS) {
        console.warn(`[score-cron] mint attempt within window, skip resend: ${row.id}`);
        return 'minting_onchain';
      }
      throw new Error(
        `CRITICAL: mint attempt stuck >${ATTEMPT_WINDOW_MS / 60000}min without tx_hash, manual review`,
      );
    }

    let attempt = '';
    await broadcastOperator(operatorWalletClient.account.address, {
      stamp: async () => {
        const stamp = new Date().toISOString();
        attempt = stamp;
        const { data, error } = await supabaseAdmin.from('score_nft_queue')
          .update({ mint_attempted_at: stamp, updated_at: stamp }).eq('id', row.id)
          .eq('locked_by', leaseOwner).is('mint_attempted_at', null).gt('lease_expires_at', stamp)
          .select('id').maybeSingle();
        if (error) throw error;
        return Boolean(data);
      },
      unstamp: async () => {
        const { error } = await supabaseAdmin.from('score_nft_queue').update({ mint_attempted_at: null })
          .eq('id', row.id).eq('mint_attempted_at', attempt).eq('locked_by', leaseOwner).is('tx_hash', null);
        if (error) throw error;
      },
      send: beforeRaw => guardedWallet(operatorWalletClient.account, operatorWalletClient.chain, beforeRaw).writeContract({
        address: ORCHESTRATOR_ADDRESS,
        abi: ORCHESTRATOR_ABI,
        functionName: 'mintScore',
        args: [user.evm_address as `0x${string}`, keccak256(stringToHex(row.id))],
      }),
      save: async hash => {
        const now = new Date().toISOString();
        const { data, error } = await supabaseAdmin.from('score_nft_queue')
          .update({ tx_hash: hash, updated_at: now }).eq('id', row.id)
          .eq('locked_by', leaseOwner).gt('lease_expires_at', now).select('id').maybeSingle();
        if (error || !data) throw Error(`CRITICAL: 已广播 ${hash} 但订单哈希未保存`);
      },
    }, deadline);
    return 'minting_onchain';
  }

  // 有 tx_hash → 查链上结果（receipt 未出 → 等下次 cron）
  console.log(`[score-cron] checking receipt: ${txHash}`);
  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    // P1-4：receipt 迟迟不出，以 mint_attempted_at 为锚超 15min → CRITICAL(route 转 manual_review)
    const anchor = row.mint_attempted_at ? new Date(row.mint_attempted_at).getTime() : null;
    if (anchor !== null && Date.now() - anchor > RECEIPT_TIMEOUT_MS) {
      throw new Error(`CRITICAL: mintScore tx ${txHash} pending >15min no receipt, manual review`);
    }
    return 'minting_onchain';
  }

  if (receipt.status !== 'success') {
    throw new Error(`tx reverted: ${txHash}`);
  }

  const tokenId = extractTokenIdFromLogs(receipt.logs);
  console.log(`[score-cron] mint confirmed, tokenId=${tokenId}`);

  const nowIso = new Date().toISOString();
  const { data: dbOk, error: dbErr } = await supabaseAdmin
    .from('score_nft_queue')
    .update({ token_id: tokenId, updated_at: nowIso })
    .eq('id', row.id)
    .eq('locked_by', leaseOwner)
    .gt('lease_expires_at', nowIso)
    .select('id')
    .maybeSingle();

  // P12 B-1 发现：DB error（如 token_id 撞唯一约束）被误判成 lease 丢失 → 无限空转。
  // 抛普通错误走 retry/failed 通道（链上已铸，token_id 可从 receipt 幂等重取，safe）
  if (dbErr) {
    throw new Error(`DB error writing tokenId=${tokenId}: ${dbErr.message}`);
  }
  if (!dbOk) {
    console.warn(`[score-cron] lease lost when writing tokenId for ${row.id}`);
    return 'minting_onchain';
  }

  return 'uploading_metadata';
}
