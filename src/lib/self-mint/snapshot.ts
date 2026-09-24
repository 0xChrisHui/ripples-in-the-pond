import 'server-only';

import { attestPermanentResource } from '@/src/lib/permanent-core/attestation';
import { canonicalizeJson, sha256Hex, type JsonValue } from '@/src/lib/score-package';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { SelfMintOrderRow } from './order';

function environment(): 'development' | 'preview' | 'production' {
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'development';
}

function identity(row: SelfMintOrderRow, kind: 'events' | 'package' | 'metadata') {
  const txId = row[`${kind}_ar_tx_id`];
  const sha256 = row[`${kind}_sha256`];
  const bytes = row[`${kind}_bytes`];
  const mime = row[`${kind}_mime`];
  if (!txId || !sha256 || !bytes || !mime || row[`${kind}_upload_state`] !== 'verified') {
    throw new Error(`${kind} verified identity 不完整`);
  }
  return { arTxId: txId, sha256, bytes, mime };
}

function json(bytes: Uint8Array, label: string): JsonValue {
  try { return JSON.parse(new TextDecoder().decode(bytes)) as JsonValue; }
  catch { throw new Error(`${label} 不是合法 JSON`); }
}

export async function publishSelfMintSnapshot(row: SelfMintOrderRow): Promise<void> {
  if (!row.token_uri) throw new Error('metadata tokenURI 不完整');
  const metadataId = identity(row, 'metadata');
  const eventsId = identity(row, 'events');
  const packageId = identity(row, 'package');
  const soundSetId = {
    arTxId: row.sounds_map_ar_tx_id,
    sha256: row.sounds_map_sha256,
    bytes: row.sounds_map_bytes,
    mime: row.sounds_map_mime,
  };
  const [metadataBytes, eventsBytes, soundsBytes] = await Promise.all([
    attestPermanentResource(metadataId),
    attestPermanentResource(eventsId),
    attestPermanentResource(soundSetId),
  ]);
  const metadata = json(metadataBytes, 'metadata');
  const events = json(eventsBytes, 'events');
  const sounds = json(soundsBytes, 'soundSet');
  const level = 'canonical' as const;
  const resourceAttestations = {
    metadata: { ...metadataId, level },
    events: { ...eventsId, level },
    package: { ...packageId, level },
    base: {
      arTxId: row.base_ar_tx_id, sha256: row.base_sha256,
      bytes: row.base_bytes, mime: row.base_mime, level,
    },
    soundSet: { ...soundSetId, level },
    decoder: {
      arTxId: row.decoder_ar_tx_id, sha256: row.decoder_sha256,
      bytes: row.decoder_bytes, mime: row.decoder_mime, level,
    },
  };
  const digestInput = {
    schemaId: 'ripples.score-snapshot.v1',
    originalTokenUri: row.token_uri,
    metadata,
    events,
    sounds,
    resourceAttestations,
    compatibility: null,
  } as JsonValue;
  const contentSha256 = await sha256Hex(canonicalizeJson(digestInput));
  const { error } = await supabaseAdmin.rpc('publish_score_playback_snapshot', {
    p_environment: environment(),
    p_chain_id: row.chain_id,
    p_contract: row.score_contract.toLowerCase(),
    p_token_id: row.token_id,
    p_queue_id: null,
    p_schema_id: 'ripples.score-snapshot.v1',
    p_original_token_uri: row.token_uri,
    p_metadata: metadata,
    p_events: events,
    p_sounds: sounds,
    p_resource_attestations: resourceAttestations,
    p_compatibility: null,
    p_content_sha256: contentSha256,
  });
  if (error) throw new Error(`P16 verified snapshot 发布失败：${error.message}`);
}
