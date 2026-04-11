import { supabaseAdmin } from '@/src/lib/supabase';
import {
  operatorWalletClient,
  publicClient,
} from '@/src/lib/operator-wallet';
import {
  ORCHESTRATOR_ADDRESS,
  ORCHESTRATOR_ABI,
  SCORE_NFT_ADDRESS,
  SCORE_NFT_ABI,
} from '@/src/lib/contracts';
import type { ScoreMintQueueRow, ScoreMintStatus } from '@/src/types/jam';

/**
 * 链上交互步骤：
 *   stepMintOnchain  → minting_onchain → uploading_metadata
 *   stepSetTokenUri  → setting_uri → success
 *
 * 幂等核心（playbook 硬门槛）：
 * - mintScore 前检查 row.tx_hash，已有则走 receipt 回查，避免重发
 * - 发送 tx 后立刻回写 tx_hash（在 mine 之前就入库），崩溃重启不重复 mint
 * - DB 写入失败 → 抛 CRITICAL 需人工介入（极罕见）
 * - setTokenURI 可重试：row.token_uri 等于目标则跳过合约调用
 */

// ERC-721 Transfer(from, to, tokenId) 事件 topic hash
// = keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

type ReceiptLog = {
  address: string;
  topics: readonly `0x${string}`[];
};

function extractTokenIdFromLogs(logs: readonly ReceiptLog[]): number {
  const log = logs.find(
    (l) =>
      l.topics[0] === TRANSFER_TOPIC &&
      l.address.toLowerCase() === SCORE_NFT_ADDRESS.toLowerCase(),
  );
  if (!log || !log.topics[3]) {
    throw new Error('Transfer event not found in receipt');
  }
  return Number(BigInt(log.topics[3]));
}

// ─────────────────────────────────────────────────
// Step: minting_onchain → uploading_metadata
// ─────────────────────────────────────────────────
export async function stepMintOnchain(
  row: ScoreMintQueueRow,
): Promise<ScoreMintStatus> {
  // 查用户 evm_address
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('evm_address')
    .eq('id', row.user_id)
    .single();
  if (!user) throw new Error(`user not found: ${row.user_id}`);

  let txHash = row.tx_hash as `0x${string}` | null;

  if (txHash) {
    console.log(`[score-cron] tx_hash exists, skip resend: ${txHash}`);
  } else {
    console.log(`[score-cron] sending mintScore tx → ${user.evm_address}`);
    txHash = await operatorWalletClient.writeContract({
      address: ORCHESTRATOR_ADDRESS,
      abi: ORCHESTRATOR_ABI,
      functionName: 'mintScore',
      args: [user.evm_address as `0x${string}`],
    });

    // 立即回写 tx_hash — 在 mine 之前就入库，避免 cron 崩溃后重发
    const { error: writeErr } = await supabaseAdmin
      .from('score_nft_queue')
      .update({
        tx_hash: txHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (writeErr) {
      // CRITICAL: tx 已发但 DB 写入失败，需人工介入
      throw new Error(
        `CRITICAL: tx ${txHash} sent but DB write failed: ${writeErr.message}`,
      );
    }
    console.log(`[score-cron] tx sent: ${txHash}`);
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') {
    throw new Error(`tx reverted: ${txHash}`);
  }

  const tokenId = extractTokenIdFromLogs(receipt.logs);
  console.log(`[score-cron] mint confirmed, tokenId=${tokenId}`);

  await supabaseAdmin
    .from('score_nft_queue')
    .update({
      token_id: tokenId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  return 'uploading_metadata';
}

// ─────────────────────────────────────────────────
// Step: setting_uri → success
// ─────────────────────────────────────────────────
export async function stepSetTokenUri(
  row: ScoreMintQueueRow,
): Promise<ScoreMintStatus> {
  if (!row.token_id || !row.metadata_ar_tx_id) {
    throw new Error('token_id or metadata_ar_tx_id missing before setTokenURI');
  }

  const tokenUri = `ar://${row.metadata_ar_tx_id}`;
  const alreadyOnChain = row.token_uri === tokenUri;

  if (!alreadyOnChain) {
    console.log(`[score-cron] setting tokenURI: ${tokenUri}`);
    const txHash = await operatorWalletClient.writeContract({
      address: SCORE_NFT_ADDRESS,
      abi: SCORE_NFT_ABI,
      functionName: 'setTokenURI',
      args: [BigInt(row.token_id), tokenUri],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`[score-cron] setTokenURI confirmed: ${txHash}`);

    await supabaseAdmin
      .from('score_nft_queue')
      .update({
        token_uri: tokenUri,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
  }

  // 写 mint_events（S6 数据主路径：DB 自包含）
  const { data: draft } = await supabaseAdmin
    .from('pending_scores')
    .select('events_data')
    .eq('id', row.pending_score_id)
    .single();

  await supabaseAdmin.from('mint_events').insert({
    mint_queue_id: null, // 这是 score_nft_queue，不是 mint_queue
    user_id: row.user_id,
    track_id: row.track_id,
    token_id: row.token_id,
    tx_hash: row.tx_hash,
    score_data: draft?.events_data ?? null,
    score_nft_token_id: row.token_id,
    metadata_ar_tx_id: row.metadata_ar_tx_id,
    score_queue_id: row.id,
  });

  console.log(`[score-cron] success, tokenId=${row.token_id}`);
  return 'success';
}
