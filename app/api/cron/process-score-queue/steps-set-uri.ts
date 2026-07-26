import { supabaseAdmin } from '@/src/lib/supabase';
import {
  operatorWalletClient,
  publicClient,
} from '@/src/lib/chain/operator-wallet';
import {
  SCORE_NFT_ADDRESS,
  SCORE_NFT_ABI,
} from '@/src/lib/chain/contracts';
import type { ScoreMintQueueRow, ScoreMintStatus } from '@/src/types/jam';

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
// P1-4：有 uri_tx_hash 但 receipt 超 15 分钟不出 → 僵尸 tx，抛 CRITICAL 转 manual_review
const RECEIPT_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Step: setting_uri → success（Phase 6 A1：拆步 + lease CAS）
 *
 * 没 uri_tx_hash → 发 setTokenURI tx + 立刻存 hash → 返回 setting_uri（不等确认）
 * 有 uri_tx_hash → 查 receipt → 写 token_uri + 写 mint_events → 推到 success
 *
 * 注意：Phase 6 C1 后 ScoreNFT.setTokenURI 仅允许首次写入，
 * 同 tokenId 重发 setTokenURI 会 revert → 一定走 uri_tx_hash 幂等恢复。
 */
export async function stepSetTokenUri(
  row: ScoreMintQueueRow,
  leaseOwner: string,
): Promise<ScoreMintStatus> {
  if (!row.token_id || !row.metadata_ar_tx_id) {
    throw new Error('token_id or metadata_ar_tx_id missing before setTokenURI');
  }

  const tokenUri = `ar://${row.metadata_ar_tx_id}`;
  let uriTxHash = row.uri_tx_hash as `0x${string}` | null;

  if (!uriTxHash) {
    const attemptedAt = row.uri_attempted_at
      ? new Date(row.uri_attempted_at).getTime()
      : null;
    const nowMs = Date.now();

    if (attemptedAt !== null) {
      if (nowMs - attemptedAt < ATTEMPT_WINDOW_MS) {
        console.warn(`[score-cron] setTokenURI attempt within window, skip resend: ${row.id}`);
        return 'setting_uri';
      }
      throw new Error(
        `CRITICAL: setTokenURI attempt stuck >${ATTEMPT_WINDOW_MS / 60000}min without uri_tx_hash, manual review`,
      );
    }

    const stampIso = new Date().toISOString();
    const { data: stampOk } = await supabaseAdmin
      .from('score_nft_queue')
      .update({ uri_attempted_at: stampIso, updated_at: stampIso })
      .eq('id', row.id)
      .eq('locked_by', leaseOwner)
      .gt('lease_expires_at', stampIso)
      .select('id')
      .maybeSingle();

    if (!stampOk) {
      console.warn(`[score-cron] lease lost before setTokenURI stamp for ${row.id}`);
      return 'setting_uri';
    }

    console.log(`[score-cron] sending setTokenURI tx: ${tokenUri}`);
    uriTxHash = await operatorWalletClient.writeContract({
      address: SCORE_NFT_ADDRESS,
      abi: SCORE_NFT_ABI,
      functionName: 'setTokenURI',
      args: [BigInt(row.token_id), tokenUri],
    });

    const nowIso = new Date().toISOString();
    const { data: dbOk } = await supabaseAdmin
      .from('score_nft_queue')
      .update({ uri_tx_hash: uriTxHash, updated_at: nowIso })
      .eq('id', row.id)
      .eq('locked_by', leaseOwner)
      .gt('lease_expires_at', nowIso)
      .select('id')
      .maybeSingle();

    if (!dbOk) {
      throw new Error(
        `CRITICAL: setTokenURI tx ${uriTxHash} broadcast but DB write lost (lease ${leaseOwner})`,
      );
    }
    console.log(`[score-cron] uri tx sent, hash saved: ${uriTxHash}`);
    return 'setting_uri';
  }

  // 有 uri_tx_hash → 查 receipt
  console.log(`[score-cron] checking uri receipt: ${uriTxHash}`);
  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: uriTxHash });
  } catch {
    // P1-4：receipt 迟迟不出，以 uri_attempted_at 为锚超 15min → CRITICAL(route 转 manual_review)
    const anchor = row.uri_attempted_at ? new Date(row.uri_attempted_at).getTime() : null;
    if (anchor !== null && Date.now() - anchor > RECEIPT_TIMEOUT_MS) {
      throw new Error(`CRITICAL: setTokenURI tx ${uriTxHash} pending >15min no receipt, manual review`);
    }
    return 'setting_uri';
  }

  if (receipt.status !== 'success') {
    throw new Error(`uri tx reverted: ${uriTxHash}`);
  }

  // setTokenURI 成功 → 写 token_uri（CAS）+ 写 mint_events（幂等 upsert）
  const nowIso = new Date().toISOString();
  const { data: dbOk } = await supabaseAdmin
    .from('score_nft_queue')
    .update({ token_uri: tokenUri, updated_at: nowIso })
    .eq('id', row.id)
    .eq('locked_by', leaseOwner)
    .gt('lease_expires_at', nowIso)
    .select('id')
    .maybeSingle();

  if (!dbOk) {
    console.warn(`[score-cron] lease lost when writing token_uri for ${row.id}`);
    return 'setting_uri';
  }

  const { data: draft } = await supabaseAdmin
    .from('pending_scores')
    .select('events_data')
    .eq('id', row.pending_score_id)
    .single();
  if (!draft) {
    throw new Error(`pending_score not found: ${row.pending_score_id}`);
  }

  // P12 B-1 发现：016h 的唯一索引是部分索引（WHERE score_queue_id IS NOT NULL），
  // PostgREST onConflict 无法把它选作仲裁 → upsert 必报 "no unique constraint"。
  // A17 之前该错误被静默吞掉（假成功），A17 加 throw 后第一次真实铸造即触雷。
  // 改为查后插：行级单写者由 lease CAS + 运营全局锁保证；部分唯一索引仍是兜底防线。
  const { data: existed, error: checkErr } = await supabaseAdmin
    .from('mint_events')
    .select('id')
    .eq('score_queue_id', row.id)
    .maybeSingle();
  if (checkErr) {
    throw new Error(`mint_events check failed for queue ${row.id}: ${checkErr.message}`);
  }
  if (!existed) {
    const { error: insertErr } = await supabaseAdmin.from('mint_events').insert({
      mint_queue_id: null,
      user_id: row.user_id,
      track_id: row.track_id,
      token_id: row.token_id,
      tx_hash: row.tx_hash,
      score_data: draft.events_data,
      score_nft_token_id: row.token_id,
      metadata_ar_tx_id: row.metadata_ar_tx_id,
      score_queue_id: row.id,
    });
    if (insertErr) {
      throw new Error(`mint_events insert failed for queue ${row.id}: ${insertErr.message}`);
    }
  }

  console.log(`[score-cron] success, tokenId=${row.token_id}`);
  return 'success';
}
