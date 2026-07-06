import { supabaseAdmin } from "@/src/lib/supabase";
import { operatorWalletClient, publicClient } from "@/src/lib/chain/operator-wallet";
import { AIRDROP_NFT_ADDRESS, AIRDROP_NFT_ABI } from "@/src/lib/chain/contracts";

/**
 * 空投队列状态机 steps（route.ts 只保留 GET 编排；P10-B P1-4 让位拆出）：
 *   tryConfirmMinting — 有 tx_hash 查链上 → 完成或回退
 *   trySendNew        — 抢 pending + 发 tx + 存 hash
 *   maybeFinishRound  — 无 pending/minting 剩余则收尾轮次
 */

const STUCK_TIMEOUT_MS = 3 * 60 * 1000;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** 查 minting 记录 → 有 tx_hash 查链上 → 完成或回退 */
export async function tryConfirmMinting() {
  const { data: item } = await supabaseAdmin
    .from("airdrop_recipients")
    .select("id, tx_hash, wallet_address, updated_at")
    .eq("status", "minting")
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!item) return null;

  if (!item.tx_hash) {
    const age = Date.now() - new Date(item.updated_at).getTime();
    if (age > STUCK_TIMEOUT_MS) {
      // 不能安全 reset — 可能链上已发但 DB 没记 hash，reset 会重复空投
      console.error(
        `[process-airdrop] CRITICAL: recipient ${item.id} 卡在 minting 无 tx_hash 已 ${age}ms — 链上状态未知，标记 failed 等人工核查 operator tx 历史`,
      );
      await supabaseAdmin
        .from("airdrop_recipients")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", item.id)
        .eq("status", "minting");
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
    await resetToPending(item.id);
    return { result: "chain_failed", recipientId: item.id };
  } catch {
    return null; // receipt 还没出来
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

async function resetToPending(recipientId: string) {
  await supabaseAdmin
    .from("airdrop_recipients")
    .update({ status: "pending", tx_hash: null, updated_at: new Date().toISOString() })
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
