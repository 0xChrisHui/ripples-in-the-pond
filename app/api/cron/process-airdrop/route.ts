import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { verifyCronSecret } from "@/src/lib/auth/cron-auth";
import { acquireOpLock, releaseOpLock } from "@/src/lib/chain/operator-lock";
import { supabaseAdmin } from "@/src/lib/supabase";
import { tryConfirmMinting, trySendNew, maybeFinishRound } from "./steps";

/**
 * GET /api/cron/process-airdrop
 * 空投 NFT 铸造 — 两步状态机，每步 < 5 秒（状态机实现见 steps.ts）：
 *   第 1 次 cron：pending → minting（发交易 + 存 tx_hash）
 *   第 2 次 cron：minting → success（查 receipt + 写 token_id）
 *
 * 每次调用优先完成 minting，再抢新 pending。
 */

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
