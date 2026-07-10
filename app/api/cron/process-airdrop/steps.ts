import { supabaseAdmin } from "@/src/lib/supabase";
import { operatorWalletClient, publicClient } from "@/src/lib/chain/operator-wallet";
import { AIRDROP_NFT_ADDRESS, AIRDROP_NFT_ABI } from "@/src/lib/chain/contracts";
import { sendAlert } from "@/src/lib/alerts/resend";

/**
 * 空投队列状态机 steps（route.ts 只保留 GET 编排；P10-B P1-4 让位拆出）：
 *   tryConfirmMinting — 有 tx_hash 查链上 → 完成或回退
 *   trySendNew        — 抢 pending + 发 tx + 存 hash
 *   maybeFinishRound  — 无 pending/minting 剩余则收尾轮次
 */

const STUCK_TIMEOUT_MS = 3 * 60 * 1000;
// P1-4：有 tx_hash 但 receipt 超 15 分钟不出 → 僵尸 tx，转 manual_review
const PENDING_TX_TIMEOUT_MS = 15 * 60 * 1000;
// P1-5：链上 revert 重试上限（对齐 mint/score 队列）
const MAX_RETRY = 3;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** minting 行转终局 manual_review + 邮件告警（P2-4）。CAS 校验仍是 minting 防重复标。 */
async function markManualReview(recipientId: string, reason: string) {
  await supabaseAdmin
    .from("airdrop_recipients")
    .update({ status: "failed", failure_kind: "manual_review", updated_at: new Date().toISOString() })
    .eq("id", recipientId)
    .eq("status", "minting");
  console.error(`[process-airdrop] manual_review recipient=${recipientId}: ${reason}`);
  void sendAlert({
    subject: "airdrop_recipients manual_review",
    body: [`recipientId: ${recipientId}`, `reason: ${reason}`].join("\n"),
  });
}

/** 查 minting 记录 → 有 tx_hash 查链上 → 完成或回退 */
export async function tryConfirmMinting() {
  const { data: item } = await supabaseAdmin
    .from("airdrop_recipients")
    .select("id, tx_hash, wallet_address, updated_at, mint_attempted_at, retry_count")
    .eq("status", "minting")
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!item) return null;

  if (!item.tx_hash) {
    const age = Date.now() - new Date(item.updated_at).getTime();
    if (age > STUCK_TIMEOUT_MS) {
      // 不能安全 reset — 可能链上已发但 DB 没记 hash，reset 会重复空投
      await markManualReview(item.id, `卡在 minting 无 tx_hash 已 ${age}ms — 链上状态未知，需核查 operator tx 历史`);
      return { result: "stuck_needs_review", recipientId: item.id };
    }
    return null;
  }

  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: item.tx_hash as `0x${string}`,
    });
    if (receipt.status === "success") {
      const tokenId = parseTokenId(receipt.logs);
      // CAS 防并发重复标 success
      await supabaseAdmin
        .from("airdrop_recipients")
        .update({
          status: "success",
          token_id: tokenId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("status", "minting");
      return { result: "confirmed", recipientId: item.id, txHash: item.tx_hash, tokenId };
    }
    // 链上 revert → 安全回退重试（tx 已结束）
    await resetToPending(item.id, item.retry_count);
    return { result: "chain_failed", recipientId: item.id };
  } catch {
    // receipt 还没出来。P1-4：以 mint_attempted_at 为锚，超 15min 判僵尸 tx → manual_review；
    // 否则 touch updated_at 让队首轮转
    const anchor = item.mint_attempted_at
      ? new Date(item.mint_attempted_at).getTime()
      : new Date(item.updated_at).getTime();
    if (Date.now() - anchor > PENDING_TX_TIMEOUT_MS) {
      await markManualReview(item.id, `tx ${item.tx_hash} pending >15min no receipt`);
      return { result: "pending_timeout_review", recipientId: item.id };
    }
    await supabaseAdmin
      .from("airdrop_recipients")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", item.id);
    return null;
  }
}

/** 抢一条 pending → 发交易 → 存 tx_hash → 返回 */
export async function trySendNew(roundId: string) {
  const { data: recipient } = await supabaseAdmin
    .from("airdrop_recipients")
    .select("id, wallet_address")
    .eq("round_id", roundId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!recipient) return null;

  // CAS：pending → minting；P1-3 同时盖 mint_attempted_at 戳（见下方 catch）
  const { data: claimed } = await supabaseAdmin
    .from("airdrop_recipients")
    .update({ status: "minting", mint_attempted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", recipient.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!claimed) return null;

  let txHash: `0x${string}`;
  try {
    txHash = await operatorWalletClient.writeContract({
      address: AIRDROP_NFT_ADDRESS,
      abi: AIRDROP_NFT_ABI,
      functionName: "mint",
      args: [recipient.wallet_address as `0x${string}`],
    });
  } catch (err) {
    // ⚠ P1-3：不 resetToPending（RPC 超时 tx 可能已广播 → 会双空投），留 minting 交时间窗
    console.error("[process-airdrop] chain send failed, left in minting:", err);
    return { result: "send_failed", recipientId: recipient.id };
  }

  // tx 已广播 — 下面任何失败都不能 reset（否则重复空投）
  const { error: dbErr } = await supabaseAdmin
    .from("airdrop_recipients")
    .update({ tx_hash: txHash, updated_at: new Date().toISOString() })
    .eq("id", recipient.id);

  if (dbErr) {
    console.error(
      `[process-airdrop] CRITICAL: tx ${txHash} 已上链但 DB 写 tx_hash 失败 recipient=${recipient.id}: ${dbErr.message}. 人工核查: UPDATE airdrop_recipients SET tx_hash='${txHash}' WHERE id='${recipient.id}'`,
    );
    return { result: "db_write_failed", recipientId: recipient.id, txHash };
  }

  return { result: "sent", recipientId: recipient.id, txHash };
}

function parseTokenId(logs: readonly { topics: readonly `0x${string}`[] }[]): number | null {
  const log = logs.find((l) => l.topics[0] === TRANSFER_TOPIC);
  const raw = log?.topics[3] ? parseInt(log.topics[3], 16) : null;
  return raw != null && !isNaN(raw) ? raw : null;
}

async function resetToPending(recipientId: string, retryCount: number) {
  // P1-5：超 MAX_RETRY 转终局 manual_review，不再无限重试
  if (retryCount + 1 >= MAX_RETRY) {
    await markManualReview(recipientId, `retry 耗尽(${retryCount + 1}/${MAX_RETRY})`);
    return;
  }
  await supabaseAdmin
    .from("airdrop_recipients")
    .update({ status: "pending", tx_hash: null, retry_count: retryCount + 1, updated_at: new Date().toISOString() })
    .eq("id", recipientId);
}

export async function maybeFinishRound(roundId: string) {
  const { count } = await supabaseAdmin
    .from("airdrop_recipients")
    .select("id", { count: "exact", head: true })
    .eq("round_id", roundId)
    .in("status", ["pending", "minting"]);

  if ((count ?? 0) === 0) {
    await supabaseAdmin
      .from("airdrop_rounds")
      .update({ status: "done" })
      .eq("id", roundId);
  }
}
