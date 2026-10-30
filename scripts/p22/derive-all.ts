/**
 * P22：用生产库里全部已发布的 Score 播放快照跑一遍素材派生（只读，只有 SELECT）。
 * 用法：tsx --env-file=.env.local scripts/p22/derive-all.ts
 */
import { createClient } from '@supabase/supabase-js';
import { parseScoreSnapshot, type ScoreSnapshotRow } from '../../src/data/score/snapshot-contract';
import { derivePack, PackDeriveError } from '../../src/lib/score-pack/derive';

type Active = { environment: string; chain_id: number; contract: string; token_id: number; revision: number };

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('缺少 Supabase 环境变量');
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: active, error } = await db.from('score_playback_snapshot_active')
    .select('environment,chain_id,contract,token_id,revision').eq('environment', 'production');
  if (error) throw error;
  let ok = 0;
  const failures: string[] = [];
  for (const row of (active ?? []) as Active[]) {
    const label = `chain ${row.chain_id} #${row.token_id}`;
    const { data: revision, error: revisionError } = await db.from('score_playback_snapshot_revisions')
      .select('revision,queue_id,schema_id,original_token_uri,metadata,events,sounds,'
        + 'resource_attestations,compatibility,content_sha256,verified_at')
      .match({ environment: row.environment, chain_id: row.chain_id, contract: row.contract,
        token_id: row.token_id, revision: row.revision }).maybeSingle();
    if (revisionError || !revision) { failures.push(`${label}：快照读取失败`); continue; }
    try {
      const snapshot = await parseScoreSnapshot(revision as unknown as ScoreSnapshotRow);
      const pack = derivePack(snapshot.playbackBootstrap);
      ok += 1;
      console.log(`✓ ${label}  背景音乐 #${pack.trackTokenId}  音效 ${pack.soundIds.length} 个`);
    } catch (caught) {
      const reason = caught instanceof PackDeriveError ? `${caught.code} ${caught.missing.join(' ')}`
        : caught instanceof Error ? caught.message : String(caught);
      failures.push(`${label}：${reason}`);
    }
  }
  console.log(`\n共 ${(active ?? []).length} 枚，可开包 ${ok}，被拒 ${failures.length}`);
  failures.forEach((line) => console.log(`✗ ${line}`));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
