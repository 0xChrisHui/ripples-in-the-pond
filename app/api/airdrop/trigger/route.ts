import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase";
import { verifyAdminToken } from "@/src/lib/auth/admin-auth";
import type { TriggerAirdropRequest } from "@/src/types/airdrop";

/**
 * POST /api/airdrop/trigger
 * 管理员触发空投：创建轮次 → 快照参与者 → 标记 ready
 *
 * 鉴权（Phase 6 D2 改）：Authorization: Bearer <ADMIN_TOKEN>
 *   旧 ?token=xxx 已弃用，runbook / 运维脚本需同步改。
 *
 * 请求体：{ round: number, title: string }
 *
 * 参与者快照逻辑：
 *   从 chain_events 的 Transfer 事件计算每个 tokenId 的当前 owner
 *   去重后得到唯一 wallet 列表（含站外地址）
 */
export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) {
    return NextResponse.json({ error: "无效的 admin token" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as TriggerAirdropRequest;
    const { round, title } = body;

    if (!round || !title) {
      return NextResponse.json(
        { error: "缺少 round 或 title" },
        { status: 400 },
      );
    }

    // 1. 创建空投轮次
    const { data: roundData, error: roundErr } = await supabaseAdmin
      .from("airdrop_rounds")
      .insert({ round, title, status: "draft" })
      .select("id")
      .single();

    if (roundErr) {
      if (roundErr.code === "23505") {
        return NextResponse.json(
          { error: `第 ${round} 轮空投已存在` },
          { status: 409 },
        );
      }
      throw roundErr;
    }

    // 2. 快照参与者：从 chain_events 计算当前 owner
    const owners = await snapshotOwners();

    // 3. 关联 user_id（如果钱包在 users 表中）
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, evm_address");
    const addrToUser = new Map<string, string>();
    for (const u of users ?? []) {
      addrToUser.set(u.evm_address.toLowerCase(), u.id);
    }

    // 4. 写入 airdrop_recipients
    const recipients = owners.map((addr) => ({
      round_id: roundData.id,
      wallet_address: addr,
      user_id: addrToUser.get(addr.toLowerCase()) ?? null,
      status: "pending" as const,
    }));

    if (recipients.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("airdrop_recipients")
        .insert(recipients);
      if (insertErr) throw insertErr;
    }

    // 5. 标记 ready
    await supabaseAdmin
      .from("airdrop_rounds")
      .update({ status: "ready" })
      .eq("id", roundData.id);

    return NextResponse.json({
      result: "ok",
      roundId: roundData.id,
      recipientCount: recipients.length,
      wallets: owners,
    });
  } catch (err) {
    console.error("POST /api/airdrop/trigger error:", err);
    return NextResponse.json(
      { error: "触发空投失败" },
      { status: 500 },
    );
  }
}

/**
 * 从 chain_events 的 Transfer 事件计算每个 tokenId 的当前 owner
 * 逻辑：每个 tokenId 最后一次 Transfer 的 to_addr 就是当前 owner
 * 去重后返回唯一 wallet 列表
 */
async function snapshotOwners(): Promise<string[]> {
  // F8: 只统计 ScoreNFT 的 Transfer（排除 MaterialNFT 等其他合约）
  const scoreNftAddr = process.env.NEXT_PUBLIC_SCORE_NFT_ADDRESS?.toLowerCase();
  const { data: events } = await supabaseAdmin
    .from("chain_events")
    .select("token_id, to_addr, block_number, log_index, contract")
    .eq("event_name", "Transfer")
    .order("block_number", { ascending: true })
    .order("log_index", { ascending: true });

  // 每个 tokenId 最后一次 Transfer 的 to_addr = 当前 owner
  const ownerMap = new Map<number, string>();
  for (const e of events ?? []) {
    // F8: 只要 ScoreNFT 合约的 Transfer
    if (scoreNftAddr && e.contract?.toLowerCase() !== scoreNftAddr) continue;
    ownerMap.set(e.token_id, e.to_addr);
  }

  // 去掉 0x0 地址（burn）和去重
  const zero = "0x0000000000000000000000000000000000000000";
  const unique = new Set<string>();
  for (const addr of ownerMap.values()) {
    if (addr.toLowerCase() !== zero) unique.add(addr);
  }

  return Array.from(unique);
}
