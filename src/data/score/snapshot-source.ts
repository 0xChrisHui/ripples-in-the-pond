import 'server-only';
import { CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import { SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';
import { supabaseAdmin } from '@/src/lib/supabase';
import { parseScoreSnapshot, type ParsedScoreSnapshot, type ScoreSnapshotRow } from './snapshot-contract';

function environment(): 'development' | 'preview' | 'production' {
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'development';
}

/** 数字 Token 热路径只读 active pointer 与它精确指向的不可变 verified revision。 */
export async function getActiveScoreSnapshot(tokenId: number): Promise<ParsedScoreSnapshot | null> {
  const identity = {
    environment: environment(), chain_id: CHAIN_ID_NUM,
    contract: SCORE_NFT_ADDRESS.toLowerCase(), token_id: tokenId,
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
