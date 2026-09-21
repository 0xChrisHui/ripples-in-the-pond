import { CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import { SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';
import { attestPermanentResource } from '@/src/lib/permanent-core/attestation';
import { canonicalizeJson, parseScorePackageV3, sha256Hex } from '@/src/lib/score-package';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { ScoreMintQueueRow, ScoreMintStatus } from '@/src/types/jam';

function environment(): 'development' | 'preview' | 'production' {
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'development';
}

function identity(arTxId: string | null, sha256: string | null, bytes: number | null, mime: string | null) {
  if (!arTxId || !sha256 || !bytes || !mime) throw new Error('snapshot 永久资源身份不完整');
  return { arTxId, sha256, bytes, mime };
}

export async function stepFinalizeSnapshot(
  row: ScoreMintQueueRow,
  leaseOwner: string,
): Promise<ScoreMintStatus> {
  void leaseOwner;
  if (!row.token_id || !row.token_uri || row.metadata_upload_state !== 'verified'
    || row.package_upload_state !== 'verified') {
    throw new Error('snapshot 前 tokenURI、metadata 或 package 尚未验证');
  }
  const refs = {
    metadata: identity(row.metadata_ar_tx_id, row.metadata_sha256, row.metadata_bytes, row.metadata_mime),
    package: identity(row.package_ar_tx_id, row.package_sha256, row.package_bytes, row.package_mime),
    events: identity(row.events_ar_tx_id, row.events_sha256, row.events_bytes, row.events_mime),
    soundSet: identity(row.sounds_map_ar_tx_id, row.sounds_map_sha256, row.sounds_map_bytes, row.sounds_map_mime),
    base: identity(row.base_ar_tx_id, row.base_sha256, row.base_bytes, row.base_mime),
    decoder: identity(row.decoder_ar_tx_id, row.decoder_sha256, row.decoder_bytes, row.decoder_mime),
  };
  const [metadataBytes, packageBytes, eventsBytes, soundsBytes] = await Promise.all([
    attestPermanentResource(refs.metadata), attestPermanentResource(refs.package),
    attestPermanentResource(refs.events), attestPermanentResource(refs.soundSet),
    attestPermanentResource(refs.base), attestPermanentResource(refs.decoder),
  ]);
  const metadata = JSON.parse(new TextDecoder().decode(metadataBytes));
  const events = JSON.parse(new TextDecoder().decode(eventsBytes));
  const sounds = JSON.parse(new TextDecoder().decode(soundsBytes));
  const scorePackage = parseScorePackageV3(JSON.parse(new TextDecoder().decode(packageBytes)));
  if (scorePackage.queueId !== row.id || scorePackage.contentId !== row.pending_score_id) {
    throw new Error('package 身份与队列不一致');
  }
  const snapshot = {
    schemaId: 'ripples.score-snapshot.v1', originalTokenUri: row.token_uri,
    metadata, events, sounds, resourceAttestations: refs, compatibility: null,
  };
  const contentSha256 = await sha256Hex(canonicalizeJson(snapshot));
  const { error } = await supabaseAdmin.rpc('publish_score_playback_snapshot', {
    p_environment: environment(), p_chain_id: CHAIN_ID_NUM,
    p_contract: SCORE_NFT_ADDRESS.toLowerCase(), p_token_id: row.token_id,
    p_queue_id: row.id, p_schema_id: snapshot.schemaId,
    p_original_token_uri: row.token_uri, p_metadata: metadata, p_events: events,
    p_sounds: sounds, p_resource_attestations: refs, p_compatibility: null,
    p_content_sha256: contentSha256,
  });
  if (error) throw new Error(`snapshot 发布失败：${error.message}`);
  return 'success';
}
