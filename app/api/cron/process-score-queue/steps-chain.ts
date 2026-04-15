import { supabaseAdmin } from '@/src/lib/supabase';
import {
  operatorWalletClient,
  publicClient,
} from '@/src/lib/chain/operator-wallet';
import {
  ORCHESTRATOR_ADDRESS,
  ORCHESTRATOR_ABI,
  SCORE_NFT_ADDRESS,
  SCORE_NFT_ABI,
} from '@/src/lib/chain/contracts';
import type { ScoreMintQueueRow, ScoreMintStatus } from '@/src/types/jam';

/**
 * 链上交互步骤（两步拆分版，每步 < 5 秒）：
 *   stepMintOnchain  → 无 tx_hash：发交易 + 存 hash；有 tx_hash：查 receipt
 *   stepSetTokenUri  → 无 uri_tx_hash：发交易 + 存 hash；有：查 receipt
 *
 * 幂等核心：tx_hash 立刻入库，崩溃重启不重发
 */

const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

type ReceiptLog = {
  address: string;
  topics: readonly `0x${string}`[];
};

function extractTokenIdFromLogs(logs: readonly ReceiptLog[]): number {
  const matches = logs.filter(
    (l) =>
      l.topics.length >= 4 &&
      l.topics[0] === TRANSFER_TOPIC &&
      l.address.toLowerCase() === SCORE_NFT_ADDRESS.toLowerCase(),
  );
  if (matches.length === 0) {
    throw new Error('Transfer event not found in receipt');
  }
  return Number(BigInt(matches[0].topics[3]));
}

// ─────────────────────────────────────────────────
// Step: minting_onchain → uploading_metadata
// ─────────────────────────────────────────────────
export async function stepMintOnchain(
  row: ScoreMintQueueRow,
): Promise<ScoreMintStatus> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('evm_address')
    .eq('id', row.user_id)
    .single();
  if (!user) throw new Error(`user not found: ${row.user_id}`);

  let txHash = row.tx_hash as `0x${string}` | null;

  if (!txHash) {
    // 没有 tx_hash → 发交易 + 立刻存 hash
    console.log(`[score-cron] sending mintScore tx → ${user.evm_address}`);
    txHash = await operatorWalletClient.writeContract({
      address: ORCHESTRATOR_ADDRESS,
      abi: ORCHESTRATOR_ABI,
      functionName: 'mintScore',
      args: [user.evm_address as `0x${string}`],
    });

    const { error: writeErr } = await supabaseAdmin
      .from('score_nft_queue')
      .update({ tx_hash: txHash, updated_at: new Date().toISOString() })
      .eq('id', row.id);

    if (writeErr) {
      throw new Error(
        `CRITICAL: tx ${txHash} sent but DB write failed: ${writeErr.message}`,
      );
    }
    console.log(`[score-cron] tx sent, hash saved: ${txHash}`);
    // 不等确认，保持 minting_onchain 状态，下次 cron 来查
    return 'minting_onchain';
  }

  // 有 tx_hash → 查链上结果
  console.log(`[score-cron] checking receipt: ${txHash}`);
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

  if (receipt.status !== 'success') {
    throw new Error(`tx reverted: ${txHash}`);
  }

  const tokenId = extractTokenIdFromLogs(receipt.logs);
  console.log(`[score-cron] mint confirmed, tokenId=${tokenId}`);

  await supabaseAdmin
    .from('score_nft_queue')
    .update({ token_id: tokenId, updated_at: new Date().toISOString() })
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
    // 💭 setTokenURI 本身幂等（同 URI 写多次无副作用），不需要拆步
    // 但耗时短（不需要 simulate），10 秒内完成
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
      .update({ token_uri: tokenUri, updated_at: new Date().toISOString() })
      .eq('id', row.id);
  }

  // 写 mint_events（upsert 幂等）
  const { data: draft } = await supabaseAdmin
    .from('pending_scores')
    .select('events_data')
    .eq('id', row.pending_score_id)
    .single();

  if (!draft) {
    throw new Error(`pending_score not found: ${row.pending_score_id}`);
  }

  await supabaseAdmin.from('mint_events').upsert(
    {
      mint_queue_id: null,
      user_id: row.user_id,
      track_id: row.track_id,
      token_id: row.token_id,
      tx_hash: row.tx_hash,
      score_data: draft.events_data,
      score_nft_token_id: row.token_id,
      metadata_ar_tx_id: row.metadata_ar_tx_id,
      score_queue_id: row.id,
    },
    { onConflict: 'score_queue_id' },
  );

  console.log(`[score-cron] success, tokenId=${row.token_id}`);
  return 'success';
}
