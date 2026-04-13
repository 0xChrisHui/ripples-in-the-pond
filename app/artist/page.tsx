import { supabaseAdmin } from "@/src/lib/supabase";

/**
 * /artist — 公开艺术家页面
 * 展示项目统计 + 108 首进度条
 * Server Component，直接查数据库
 */

const TOTAL_TRACKS = 108;
const AIRDROP_INTERVAL = 36;

async function getStats() {
  const { count: trackCount } = await supabaseAdmin
    .from("tracks")
    .select("id", { count: "exact", head: true });

  const { count: materialMints } = await supabaseAdmin
    .from("mint_events")
    .select("id", { count: "exact", head: true })
    .is("score_nft_token_id", null);

  const { count: scoreMints } = await supabaseAdmin
    .from("score_nft_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "success");

  const { data: participants } = await supabaseAdmin
    .from("mint_events")
    .select("user_id");
  const uniqueUsers = new Set(
    (participants ?? []).map((p) => p.user_id),
  );
  const { data: scoreParticipants } = await supabaseAdmin
    .from("score_nft_queue")
    .select("user_id")
    .eq("status", "success");
  for (const p of scoreParticipants ?? []) uniqueUsers.add(p.user_id);

  const published = trackCount ?? 0;
  const totalMints = (materialMints ?? 0) + (scoreMints ?? 0);
  const progress = Math.round((published / TOTAL_TRACKS) * 100);
  const currentRound = Math.floor(published / AIRDROP_INTERVAL) + 1;
  const nextAirdrop = Math.min(currentRound * AIRDROP_INTERVAL, TOTAL_TRACKS);

  return { published, totalMints, participants: uniqueUsers.size, progress, nextAirdrop };
}

export default async function ArtistPage() {
  const stats = await getStats();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-16 text-white">
      <h1 className="mb-2 text-lg font-light tracking-[0.3em] text-white/80">
        Ripples in the Pond
      </h1>
      <p className="mb-12 text-sm text-white/40">艺术家 · 项目进度</p>

      {/* 进度条 */}
      <div className="mb-12 w-full max-w-md">
        <div className="mb-2 flex justify-between text-xs text-white/50">
          <span>{stats.published} / {TOTAL_TRACKS} 首曲目</span>
          <span>{stats.progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${stats.progress}%` }}
          />
        </div>
        {/* 空投标记点 */}
        <div className="relative mt-1 h-4 w-full">
          {[36, 72, 108].map((milestone) => (
            <div
              key={milestone}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${(milestone / TOTAL_TRACKS) * 100}%`, transform: "translateX(-50%)" }}
            >
              <div className={`h-2 w-px ${stats.published >= milestone ? "bg-blue-400" : "bg-white/20"}`} />
              <span className="text-[10px] text-white/30">{milestone}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid w-full max-w-md grid-cols-2 gap-4">
        <StatCard label="已发布曲目" value={stats.published} />
        <StatCard label="总铸造数" value={stats.totalMints} />
        <StatCard label="参与者" value={stats.participants} />
        <StatCard label="下次空投" value={`第 ${stats.nextAirdrop} 首`} />
      </div>

      <p className="mt-12 text-xs text-white/20">
        每 {AIRDROP_INTERVAL} 首曲目发布时触发一轮空投
      </p>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-white/40">{label}</div>
    </div>
  );
}
