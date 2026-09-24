import 'server-only';
import { supabaseAdmin } from '@/src/lib/supabase';
import { LEGACY_SCORE_CHAIN_ID, LEGACY_SCORE_CONTRACT } from './legacy-identity';
import { parseScoreSnapshot, type ParsedScoreSnapshot, type ScoreSnapshotRow } from './snapshot-contract';

function environment(): 'development' | 'preview' | 'production' {
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'development';
}

/** 数字 Token 热路径只读 active pointer 与它精确指向的不可变 verified revision。 */
export async function getActiveScoreSnapshot(tokenId: number, asset?: {
  chainId: number;
  contract: string;
}): Promise<ParsedScoreSnapshot | null> {
  const identity = {
    environment: environment(), chain_id: asset?.chainId ?? LEGACY_SCORE_CHAIN_ID,
    contract: (asset?.contract ?? LEGACY_SCORE_CONTRACT).toLowerCase(), token_id: tokenId,
  };
  const { data: active, error: activeError } = await supabaseAdmin
    .from('score_playback_snapshot_active')
    .select('revision')
    .match(identity)
    .maybeSingle();
  if (activeError) throw new Error(`active snapshot pointer 读取失败：${activeError.message}`);
  if (!active) return null;

  const { data: revision, error: revisionError } = await supabaseAdmin
    .from('score_playback_snapshot_revisions')
    .select('revision,queue_id,schema_id,original_token_uri,metadata,events,sounds,'
      + 'resource_attestations,compatibility,content_sha256,verified_at')
    .match({ ...identity, revision: active.revision })
    .maybeSingle();
  if (revisionError) throw new Error(`active snapshot revision 读取失败：${revisionError.message}`);
  if (!revision) throw new Error('active snapshot pointer 指向不存在的 revision');
  return parseScoreSnapshot(revision as unknown as ScoreSnapshotRow);
}
