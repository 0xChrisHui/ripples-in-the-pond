import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/src/lib/auth/cron-auth";
import { supabaseAdmin } from "@/src/lib/supabase";
import { operatorWalletClient, publicClient } from "@/src/lib/chain/operator-wallet";
import { SCORE_ACTIVE_STATUSES } from "@/src/types/jam";
import { sendAlert } from "@/src/lib/alerts/resend";
import { formatEther } from "viem";

/**
 * GET /api/cron/check-balance?secret=xxx
 * 每小时运行一次：检查运营钱包余额 + 队列积压
 * 低余额或积压过多 → console.error + 写 system_kv 告警记录
 * 未来接 Telegram（Phase 5），当前只做检查 + 记录
 */

const LOW_BALANCE_ETH = 0.005;
const QUEUE_BACKLOG_LIMIT = 50;
// P12 C4：活跃行超过 30 分钟无更新 = 管道卡死（正常 cron 每分钟都会 touch 行）
const STUCK_AGE_MS = 30 * 60 * 1000;

/** 查队列最老活跃行的"未更新时长"，超阈值返回告警文案（无活跃行/未超时返回 null） */
async function checkStuckAge(
  table: "mint_queue" | "score_nft_queue",
  activeStatuses: readonly string[],
): Promise<string | null> {
  const { data: oldest } = await supabaseAdmin
    .from(table)
    .select("id, updated_at")
    .in("status", activeStatuses as string[])
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!oldest) return null;
  const ageMs = Date.now() - new Date(oldest.updated_at).getTime();
  if (ageMs <= STUCK_AGE_MS) return null;
  return `${table} 疑似卡死: 行 ${oldest.id} 已 ${Math.round(ageMs / 60000)} 分钟无更新 (阈值 30 分钟)`;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "无效的 secret" }, { status: 401 });
  }

  const alerts: string[] = [];

  try {
    // 1. 检查运营钱包余额（P3-14：复用已绑定的钱包 client，不再二次触碰私钥）
    const balance = await publicClient.getBalance({
      address: operatorWalletClient.account.address,
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

    // 3. 检查 score_nft_queue 积压（用枚举常量，避免拼错状态名）
    const { count: scoreBacklog } = await supabaseAdmin
      .from("score_nft_queue")
      .select("id", { count: "exact", head: true })
      .in("status", SCORE_ACTIVE_STATUSES);

    if ((scoreBacklog ?? 0) > QUEUE_BACKLOG_LIMIT) {
      const msg = `score_nft_queue 积压: ${scoreBacklog} 件 (阈值 ${QUEUE_BACKLOG_LIMIT})`;
      console.error(`[check-balance] ${msg}`);
      alerts.push(msg);
    }

    // 3.5 P12 C4：卡龄检测（数量正常但行卡死时，上面两项抓不到）
    const stuckMsgs = await Promise.all([
      checkStuckAge("mint_queue", ["pending", "minting_onchain"]),
      checkStuckAge("score_nft_queue", SCORE_ACTIVE_STATUSES),
    ]);
    for (const msg of stuckMsgs) {
      if (msg) {
        console.error(`[check-balance] ${msg}`);
        alerts.push(msg);
      }
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

      // P2-3：低余额/积压告警接邮件（sendAlert 内部自带 try/catch + 未配 env 静默 log）
      void sendAlert({
        subject: "运营钱包/队列告警",
        body: [
          ...alerts,
          `ethBalance: ${ethBalance.toFixed(6)}`,
          `mintBacklog: ${mintBacklog ?? 0}`,
          `scoreBacklog: ${scoreBacklog ?? 0}`,
        ].join("\n"),
      });
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
