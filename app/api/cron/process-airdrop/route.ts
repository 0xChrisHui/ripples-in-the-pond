import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { verifyCronSecret } from "@/src/lib/auth/cron-auth";
import { acquireOpLock, releaseOpLock } from "@/src/lib/chain/operator-lock";
import { supabaseAdmin } from "@/src/lib/supabase";
import { operatorWalletClient, publicClient } from "@/src/lib/chain/operator-wallet";
import { AIRDROP_NFT_ADDRESS, AIRDROP_NFT_ABI } from "@/src/lib/chain/contracts";

/**
 * GET /api/cron/process-airdrop
 * 空投 NFT 铸造 — 两步状态机，每步 < 5 秒：
 *   第 1 次 cron：pending → minting（发交易 + 存 tx_hash）
 *   第 2 次 cron：minting → success（查 receipt + 写 token_id）
 *
 * 每次调用优先完成 minting，再抢新 pending。
 */

const STUCK_TIMEOUT_MS = 3 * 60 * 1000;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "无效的 secret" }, { status: 401 });
  }

  // Phase 6 P0-3 hard kill switch（2026-05-08 strict CTO review）：
  // D1 决策"主网不做空投"原本只靠 cron-job.org 不配 + admin Bearer 不暴露两层文档约束。
  // 这里加代码层硬开关 — 主网 Vercel 不设 AIRDROP_ENABLED，即使 CRON_SECRET 泄露 +
  // 任何人 GET 此端点也只会拿到 disabled 响应。测试网想跑空投显式设 'true'。
  if (process.env.AIRDROP_ENABLED !== "true") {
    return NextResponse.json({ result: "disabled" });
  }

  // Phase 6 A0：入口拿运营钱包全局锁，避免和 mint / score cron nonce race
  const holder = `airdrop-${randomUUID()}`;
  if (!(await acquireOpLock(holder))) {
    return NextResponse.json({ result: "busy" });
  }

  try {
    // 步骤 1：优先完成已发交易的 minting
    const confirmed = await tryConfirmMinting();
    if (confirmed) return NextResponse.json(confirmed);

    // 找到活跃轮次
    const { data: round } = await supabaseAdmin
      .from("airdrop_rounds")
      .select("id, status")
      .in("status", ["ready", "distributing"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!round) return NextResponse.json({ result: "idle" });

    if (round.status === "ready") {
      await supabaseAdmin
        .from("airdrop_rounds")
        .update({ status: "distributing" })
        .eq("id", round.id);
    }

    // 步骤 2：抢新 pending → 发交易 → 存 tx_hash → 返回
    const sent = await trySendNew(round.id);
    if (sent) return NextResponse.json(sent);

    // 没有 pending 了，检查是否轮次完成
    await maybeFinishRound(round.id);
    return NextResponse.json({ result: "round_check", roundId: round.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[process-airdrop] error:", msg);
    return NextResponse.json(
      { error: "处理空投失败", detail: msg },
      { status: 500 },
    );
  } finally {
    await releaseOpLock(holder);
  }
}

/** 查 minting 记录 → 有 tx_hash 查链上 → 完成或回退 */
async function tryConfirmMinting() {
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
async function trySendNew(roundId: string) {
  const { data: recipient } = await supabaseAdmin
    .from("airdrop_recipients")
    .select("id, wallet_address")
    .eq("round_id", roundId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!recipient) return null;

  // CAS：pending → minting
  const { data: claimed } = await supabaseAdmin
    .from("airdrop_recipients")
    .update({ status: "minting", updated_at: new Date().toISOString() })
    .eq("id", recipient.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!claimed) return null;

  // 严格区分：链上 send 失败（安全 reset）vs DB 写 tx_hash 失败（不能 reset 会重复空投）
  let txHash: `0x${string}`;
  try {
    txHash = await operatorWalletClient.writeContract({
      address: AIRDROP_NFT_ADDRESS,
      abi: AIRDROP_NFT_ABI,
      functionName: "mint",
      args: [recipient.wallet_address as `0x${string}`],
    });
  } catch (err) {
    console.error("[process-airdrop] chain send failed:", err);
    await resetToPending(recipient.id);
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

async function maybeFinishRound(roundId: string) {
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
