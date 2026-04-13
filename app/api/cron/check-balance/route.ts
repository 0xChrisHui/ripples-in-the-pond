import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase";
import { publicClient } from "@/src/lib/operator-wallet";
import { formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * GET /api/cron/check-balance?secret=xxx
 * 每小时运行一次：检查运营钱包余额 + 队列积压
 * 低余额或积压过多 → console.error + 写 system_kv 告警记录
 * 未来接 Telegram（Phase 5），当前只做检查 + 记录
 */

const LOW_BALANCE_ETH = 0.05;
const QUEUE_BACKLOG_LIMIT = 50;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "无效的 secret" }, { status: 401 });
  }

  const alerts: string[] = [];

  try {
    // 1. 检查运营钱包余额
    const account = privateKeyToAccount(
      process.env.OPERATOR_PRIVATE_KEY as `0x${string}`,
    );
    const balance = await publicClient.getBalance({
      address: account.address,
    });
    const ethBalance = parseFloat(formatEther(balance));

    if (ethBalance < LOW_BALANCE_ETH) {
      const msg = `运营钱包余额过低: ${ethBalance.toFixed(6)} ETH (阈值 ${LOW_BALANCE_ETH})`;
      console.error(`[check-balance] ${msg}`);
      alerts.push(msg);
    }

    // 2. 检查 mint_queue 积压
    const { count: mintBacklog } = await supabaseAdmin
      .from("mint_queue")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "minting_onchain"]);

    if ((mintBacklog ?? 0) > QUEUE_BACKLOG_LIMIT) {
      const msg = `mint_queue 积压: ${mintBacklog} 件 (阈值 ${QUEUE_BACKLOG_LIMIT})`;
      console.error(`[check-balance] ${msg}`);
      alerts.push(msg);
    }

    // 3. 检查 score_nft_queue 积压
    const { count: scoreBacklog } = await supabaseAdmin
      .from("score_nft_queue")
      .select("id", { count: "exact", head: true })
      .in("status", [
        "pending",
        "uploading_sounds",
        "uploading_metadata",
        "minting_onchain",
      ]);

    if ((scoreBacklog ?? 0) > QUEUE_BACKLOG_LIMIT) {
      const msg = `score_nft_queue 积压: ${scoreBacklog} 件 (阈值 ${QUEUE_BACKLOG_LIMIT})`;
      console.error(`[check-balance] ${msg}`);
      alerts.push(msg);
    }

    // 4. 有告警 → 写 system_kv
    if (alerts.length > 0) {
      await supabaseAdmin.from("system_kv").upsert(
        {
          key: "last_balance_alert",
          value: JSON.stringify({
            alerts,
            ethBalance: ethBalance.toFixed(6),
            mintBacklog: mintBacklog ?? 0,
            scoreBacklog: scoreBacklog ?? 0,
            timestamp: new Date().toISOString(),
          }),
        },
        { onConflict: "key" },
      );
    }

    return NextResponse.json({
      result: "ok",
      ethBalance: ethBalance.toFixed(6),
      mintBacklog: mintBacklog ?? 0,
      scoreBacklog: scoreBacklog ?? 0,
      alertCount: alerts.length,
      alerts,
    });
  } catch (err) {
    console.error("[check-balance] error:", err);
    return NextResponse.json(
      { error: "检查失败" },
      { status: 500 },
    );
  }
}
