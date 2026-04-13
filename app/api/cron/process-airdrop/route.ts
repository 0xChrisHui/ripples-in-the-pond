import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase";
import { operatorWalletClient, publicClient } from "@/src/lib/operator-wallet";
import { AIRDROP_NFT_ADDRESS, AIRDROP_NFT_ABI } from "@/src/lib/contracts";

/**
 * GET /api/cron/process-airdrop?secret=xxx
 * 每次处理一个 pending recipient → mint AirdropNFT → 标记 success
 * 幂等：minting 状态超时回退 + CAS 推进
 */

const MINTING_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟超时

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "无效的 secret" }, { status: 401 });
  }

  try {
    // 0. 回退卡住的 minting 状态
    await recoverStuck();

    // 1. 找一个 ready/distributing 的轮次
    const { data: round } = await supabaseAdmin
      .from("airdrop_rounds")
      .select("id, status")
      .in("status", ["ready", "distributing"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!round) {
      return NextResponse.json({ result: "idle", message: "没有待处理的空投轮次" });
    }

    // 标记为 distributing
    if (round.status === "ready") {
      await supabaseAdmin
        .from("airdrop_rounds")
        .update({ status: "distributing" })
        .eq("id", round.id);
    }

    // 2. 取一个 pending 的 recipient（CAS 抢单）
    const { data: recipient } = await supabaseAdmin
      .from("airdrop_recipients")
      .select("id, wallet_address")
      .eq("round_id", round.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!recipient) {
      // 所有 recipient 都处理完了，检查是否全部 success
      await maybeFinishRound(round.id);
      return NextResponse.json({ result: "round_check", roundId: round.id });
    }

    // CAS：pending → minting
    const { data: claimed } = await supabaseAdmin
      .from("airdrop_recipients")
      .update({ status: "minting" })
      .eq("id", recipient.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!claimed) {
      return NextResponse.json({ result: "skipped", message: "被其他 worker 抢走" });
    }

    // 3. 链上 mint
    const txHash = await publicClient.simulateContract({
      address: AIRDROP_NFT_ADDRESS,
      abi: AIRDROP_NFT_ABI,
      functionName: "mint",
      args: [recipient.wallet_address as `0x${string}`],
      account: operatorWalletClient.account,
    }).then(({ request }) =>
      operatorWalletClient.writeContract(request),
    );

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // 从 Transfer 事件解析 tokenId
    const transferLog = receipt.logs.find(
      (l) => l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    );
    const tokenId = transferLog
      ? parseInt(transferLog.topics[3]!, 16)
      : null;

    // 4. 标记 success
    await supabaseAdmin
      .from("airdrop_recipients")
      .update({
        status: "success",
        tx_hash: txHash,
        token_id: tokenId,
      })
      .eq("id", recipient.id);

    return NextResponse.json({
      result: "minted",
      recipientId: recipient.id,
      wallet: recipient.wallet_address,
      txHash,
      tokenId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[process-airdrop] error:", msg, err);
    return NextResponse.json(
      { error: "处理空投失败", detail: msg },
      { status: 500 },
    );
  }
}

/** 回退超时的 minting 状态 */
async function recoverStuck() {
  const cutoff = new Date(Date.now() - MINTING_TIMEOUT_MS).toISOString();
  await supabaseAdmin
    .from("airdrop_recipients")
    .update({ status: "pending" })
    .eq("status", "minting")
    .lt("created_at", cutoff);
}

/** 检查轮次是否全部完成 */
async function maybeFinishRound(roundId: string) {
  const { count: remaining } = await supabaseAdmin
    .from("airdrop_recipients")
    .select("id", { count: "exact", head: true })
    .eq("round_id", roundId)
    .in("status", ["pending", "minting"]);

  if ((remaining ?? 0) === 0) {
    await supabaseAdmin
      .from("airdrop_rounds")
      .update({ status: "done" })
      .eq("id", roundId);
  }
}
