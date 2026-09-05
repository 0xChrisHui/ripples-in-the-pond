import 'server-only';
import { cache } from 'react';
import { supabaseAdmin } from '@/src/lib/supabase';
import { resolveArUrl } from '@/src/lib/arweave';
import { explorerTxUrl } from '@/src/lib/chain/chain-config';
import { SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';
import { getScoreFromChain, getScoreOwner } from './score-fallback';
import { createScoreProvenance, loadScoreMetadata } from './score/metadata';
import type { ScoreProvenance } from './score/metadata';
import type { ScoreMintStatus, ScorePlaybackManifest } from '@/src/types/jam';
import type { Track } from '@/src/types/tracks';

type ScoreSource = 'database' | 'chain';
type PublicFailure = 'data_unavailable' | 'queue_failed' | 'metadata_unavailable';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ScorePageBase = {
  state: 'ready' | 'processing' | 'failed'; source: ScoreSource;
  id: string; queueId: string | null; tokenId?: number; queueStatus: ScoreMintStatus | null;
  trackTitle: string; creatorAddress: string; currentHolder: string | null;
  coverUrl: string; permanentEventCount: number | null;
  createdAt: string | null; confirmedAt: string | null;
  /** B3 迁移前兼容旧页面；新 UI 使用 createdAt 与 metadata 的确认来源。 */
  mintedAt: string; txHash?: string; etherscanUrl?: string; degraded?: boolean;
  animationUrl?: string; provenance: ScoreProvenance;
};
export type ScoreReadyData = ScorePageBase & {
  state: 'ready'; tokenId: number; track?: Track; eventCount: number;
  metadataRef: string; manifest: ScorePlaybackManifest;
};
export type ScoreProcessingData = ScorePageBase & {
  state: 'processing'; track: Track; eventCount: number; manifest?: never;
};
export type ScoreFailedData = ScorePageBase & {
  state: 'failed'; track?: never; eventCount: number | null;
  publicFailure: PublicFailure; failureKind: string | null; manifest?: never;
};
export type ScorePageData = ScoreReadyData | ScoreProcessingData | ScoreFailedData;
export type { ScoreProvenance } from './score/metadata';

type QueueRow = {
  id: string; status: ScoreMintStatus; token_id: number | null; token_uri: string | null;
  tx_hash: string | null; uri_tx_hash: string | null; created_at: string;
  cover_ar_tx_id: string; metadata_ar_tx_id: string | null; failure_kind: string | null;
  user_id: string; pending_score_id: string; track_id: string;
};
const provenance = (input: Partial<Parameters<typeof createScoreProvenance>[0]> = {}) => (
  createScoreProvenance({
    contract: SCORE_NFT_ADDRESS, tokenId: null, holder: null, creator: null,
    mintTx: null, setUriTx: null, metadataRef: null, manifest: null,
    tokenUriSource: 'database', ...input,
  })
);

function unavailable(queue: QueueRow, eventCount: number): ScoreFailedData {
  const tokenId = queue.token_id ?? undefined;
  return {
    state: 'failed', source: 'database', id: tokenId == null ? queue.id : String(tokenId),
    queueId: queue.id, tokenId, queueStatus: queue.status,
    trackTitle: '作品资料暂不可用', creatorAddress: '', currentHolder: null,
    coverUrl: '', eventCount, permanentEventCount: null, createdAt: queue.created_at,
    confirmedAt: null, mintedAt: queue.created_at, publicFailure: 'data_unavailable',
    failureKind: queue.failure_kind, txHash: queue.tx_hash ?? undefined,
    etherscanUrl: queue.tx_hash ? explorerTxUrl(queue.tx_hash) : undefined,
    provenance: provenance({ tokenId: queue.token_id, mintTx: queue.tx_hash,
      setUriTx: queue.uri_tx_hash }),
  };
}

export const getScoreById = cache(async (id: string): Promise<ScorePageData | null> => {
  if (/^\d+$/.test(id)) {
    const tokenId = Number(id);
    if (!Number.isSafeInteger(tokenId) || tokenId < 1) return null;
    return getScoreByTokenId(tokenId);
  }
  if (!UUID_RE.test(id)) return null;
  return getScoreByQueueId(id);
});

async function getScoreByTokenId(tokenId: number): Promise<ScorePageData | null> {
  try {
    const { data, error } = await supabaseAdmin.from('score_nft_queue').select('id')
      .eq('token_id', tokenId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return getScoreFromChain(tokenId);
    return (await getScoreByQueueId(data.id)) ?? getScoreFromChain(tokenId);
  } catch (error) {
    console.error('[score-source] database path failed, using chain:', tokenId, error);
    return getScoreFromChain(tokenId);
  }
}

async function getScoreByQueueId(queueId: string): Promise<ScorePageData | null> {
  const { data, error } = await supabaseAdmin.from('score_nft_queue').select(
    'id,status,token_id,token_uri,tx_hash,uri_tx_hash,created_at,cover_ar_tx_id,'
    + 'metadata_ar_tx_id,failure_kind,user_id,pending_score_id,track_id',
  ).eq('id', queueId).maybeSingle();
  if (error) {
    console.error('[score-source] queue query failed:', error);
    throw new Error('作品数据库暂时不可用');
  }
  if (!data) return null;
  return buildQueueScore(data as unknown as QueueRow);
}

async function buildQueueScore(queue: QueueRow): Promise<ScorePageData> {
  const [pending, trackResult, user, holder] = await Promise.all([
    supabaseAdmin.from('pending_scores').select('event_count').eq('id', queue.pending_score_id).maybeSingle(),
    supabaseAdmin.from('tracks').select('*').eq('id', queue.track_id).maybeSingle(),
    supabaseAdmin.from('users').select('evm_address').eq('id', queue.user_id).maybeSingle(),
    queue.token_id == null ? Promise.resolve(null) : getScoreOwner(queue.token_id),
  ]);
  const track = trackResult.data as Track | null;
  const creator = typeof user.data?.evm_address === 'string' ? user.data.evm_address : null;
  const eventCount = typeof pending.data?.event_count === 'number' ? pending.data.event_count : null;
  if (eventCount == null) throw new Error('作品事件数暂时不可用');
  if (trackResult.error || user.error) throw new Error('作品关联数据暂时不可用');
  if (!track || !creator) {
    console.error('[score-source] required queue relation unavailable:', queue.id);
    return unavailable(queue, eventCount);
  }
  let coverUrl = '';
  try { coverUrl = resolveArUrl(queue.cover_ar_tx_id); } catch { /* processing 保留文字身份。 */ }
  const base = {
    source: 'database' as const, queueId: queue.id, tokenId: queue.token_id ?? undefined,
    queueStatus: queue.status, trackTitle: track.title, creatorAddress: creator,
    currentHolder: holder, track, coverUrl, eventCount, permanentEventCount: null,
    createdAt: queue.created_at, confirmedAt: null, mintedAt: queue.created_at,
    txHash: queue.tx_hash ?? undefined,
    etherscanUrl: queue.tx_hash ? explorerTxUrl(queue.tx_hash) : undefined,
  };
  const metadataFailure = (): ScoreFailedData => ({
    ...base, track: undefined, state: 'failed',
    id: queue.token_id == null ? queue.id : String(queue.token_id),
    publicFailure: 'metadata_unavailable', failureKind: queue.failure_kind,
    provenance: provenance({ tokenId: queue.token_id, holder, creator, mintTx: queue.tx_hash,
      setUriTx: queue.uri_tx_hash, metadataRef: queue.token_uri }),
  });
  if (queue.status === 'failed') {
    return { ...base, track: undefined, state: 'failed',
      id: queue.token_id == null ? queue.id : String(queue.token_id),
      publicFailure: 'queue_failed', failureKind: queue.failure_kind,
      provenance: provenance({ tokenId: queue.token_id, holder, creator, mintTx: queue.tx_hash,
        setUriTx: queue.uri_tx_hash }) };
  }
  if (queue.status !== 'success') {
    return { ...base, state: 'processing', id: queue.id,
      provenance: provenance({ tokenId: queue.token_id, holder, creator, mintTx: queue.tx_hash,
        setUriTx: queue.uri_tx_hash }) };
  }
  if (queue.token_id == null || !queue.metadata_ar_tx_id
    || queue.token_uri !== `ar://${queue.metadata_ar_tx_id}`) {
    return metadataFailure();
  }
  try {
    const metadata = await loadScoreMetadata(queue.token_uri);
    const manifest = metadata.manifest;
    return {
      ...base, state: 'ready', id: String(queue.token_id), tokenId: queue.token_id,
      trackTitle: metadata.trackTitle ?? metadata.name ?? track.title,
      coverUrl: metadata.coverUrl ?? coverUrl, eventCount: metadata.eventCount ?? eventCount,
      permanentEventCount: metadata.eventCount,
      confirmedAt: null, mintedAt: metadata.mintedAt ?? queue.created_at,
      metadataRef: metadata.metadataRef, manifest,
      provenance: provenance({ tokenId: queue.token_id, holder, creator, mintTx: queue.tx_hash,
        setUriTx: queue.uri_tx_hash, metadataRef: metadata.metadataRef, manifest }),
    };
  } catch (error) {
    console.error('[score-source] permanent metadata invalid:', queue.id, error);
    return metadataFailure();
  }
}
