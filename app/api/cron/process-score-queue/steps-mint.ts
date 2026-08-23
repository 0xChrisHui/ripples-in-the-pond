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
): Promise<ScoreMintStatus> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('evm_address')
    .eq('id', row.user_id)
    .single();
  if (!user) throw new Error(`user not found: ${row.user_id}`);

  let txHash = row.tx_hash as `0x${string}` | null;

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

    const stampIso = new Date().toISOString();
    const { data: stampOk } = await supabaseAdmin
      .from('score_nft_queue')
      .update({ mint_attempted_at: stampIso, updated_at: stampIso })
      .eq('id', row.id)
      .eq('locked_by', leaseOwner)
      .gt('lease_expires_at', stampIso)
      .select('id')
      .maybeSingle();

    if (!stampOk) {
      console.warn(`[score-cron] lease lost before mint stamp for ${row.id}`);
      return 'minting_onchain';
    }

    // CT-4：稳定 orderId = 队列 row.id 的 keccak256。合约按 orderId 幂等去重，
    // 同一录制即便重试 / lease 竞态也不会双铸（同 orderId 二次调用合约 revert）。
    const orderId = keccak256(stringToHex(row.id));
    console.log(`[score-cron] sending mintScore tx → ${user.evm_address}`);
    txHash = await operatorWalletClient.writeContract({
      address: ORCHESTRATOR_ADDRESS,
      abi: ORCHESTRATOR_ABI,
      functionName: 'mintScore',
      args: [user.evm_address as `0x${string}`, orderId],
    });

    const nowIso = new Date().toISOString();
    const { data: dbOk } = await supabaseAdmin
      .from('score_nft_queue')
      .update({ tx_hash: txHash, updated_at: nowIso })
      .eq('id', row.id)
      .eq('locked_by', leaseOwner)
      .gt('lease_expires_at', nowIso)
      .select('id')
      .maybeSingle();

    if (!dbOk) {
      throw new Error(
        `CRITICAL: mintScore tx ${txHash} broadcast but DB write lost (lease ${leaseOwner})`,
      );
    }
    console.log(`[score-cron] tx sent, hash saved: ${txHash}`);
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
