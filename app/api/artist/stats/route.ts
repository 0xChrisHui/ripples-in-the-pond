import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase";

/**
 * GET /api/artist/stats
 * 公开 API，无需鉴权
 * 返回项目统计：曲目数 / 铸造数 / 参与者数 / 进度
 */

const TOTAL_TRACKS_GOAL = 108;
const AIRDROP_INTERVAL = 36;

export async function GET() {
  try {
    // 1. 已发布曲目数
    const { count: trackCount } = await supabaseAdmin
      .from("tracks")
      .select("id", { count: "exact", head: true });

    // 2. Material NFT 铸造数（成功的）
    const { count: materialMints } = await supabaseAdmin
      .from("mint_events")
      .select("id", { count: "exact", head: true })
      .is("score_nft_token_id", null);

    // 3. Score NFT 铸造数（成功的）
    const { count: scoreMints } = await supabaseAdmin
      .from("score_nft_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "success");

    // 4. 总参与者数（不同 user_id 有铸造记录的）
    const { data: participants } = await supabaseAdmin
      .from("mint_events")
      .select("user_id");

    const uniqueUsers = new Set(
      (participants ?? []).map((p) => p.user_id),
    );

    // 也统计 score_nft_queue 的参与者
    const { data: scoreParticipants } = await supabaseAdmin
      .from("score_nft_queue")
      .select("user_id")
      .eq("status", "success");

    for (const p of scoreParticipants ?? []) {
      uniqueUsers.add(p.user_id);
    }

    const published = trackCount ?? 0;
    const totalMints = (materialMints ?? 0) + (scoreMints ?? 0);
    const currentRound = Math.floor(published / AIRDROP_INTERVAL) + 1;
    const nextAirdropAt = Math.min(
      currentRound * AIRDROP_INTERVAL,
      TOTAL_TRACKS_GOAL,
    );

    return NextResponse.json({
      publishedTracks: published,
      totalTracksGoal: TOTAL_TRACKS_GOAL,
      totalMints,
      materialMints: materialMints ?? 0,
      scoreMints: scoreMints ?? 0,
      participants: uniqueUsers.size,
      currentRound,
      nextAirdropAt,
      progress: Math.round((published / TOTAL_TRACKS_GOAL) * 100),
    });
  } catch (err) {
    console.error("GET /api/artist/stats error:", err);
    return NextResponse.json(
      { error: "获取统计失败" },
      { status: 500 },
    );
  }
}
