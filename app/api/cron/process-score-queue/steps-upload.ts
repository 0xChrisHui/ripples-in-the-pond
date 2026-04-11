import { supabaseAdmin } from '@/src/lib/supabase';
import { uploadBuffer, resolveArUrl } from '@/src/lib/arweave';
import type {
  ScoreMintQueueRow,
  ScoreMintStatus,
  ScoreMetadata,
  KeyEvent,
} from '@/src/types/jam';

/**
 * Arweave 上传相关步骤：
 *   stepUploadEvents  → pending/uploading_events → minting_onchain
 *   stepUploadMetadata → uploading_metadata → setting_uri
 *
 * 幂等性：Arweave 内容寻址，同内容重传拿到同 txid。
 * 状态字段 events_ar_tx_id / metadata_ar_tx_id 存在时直接短路返回。
 */

// ─────────────────────────────────────────────────
// Step: uploading events.json
// ─────────────────────────────────────────────────
export async function stepUploadEvents(
  row: ScoreMintQueueRow,
): Promise<ScoreMintStatus> {
  if (row.events_ar_tx_id) {
    console.log(`[score-cron] events already uploaded: ${row.events_ar_tx_id}`);
    return 'minting_onchain';
  }

  // pending → uploading_events 标记"正在上传"
  if (row.status === 'pending') {
    await supabaseAdmin
      .from('score_nft_queue')
      .update({
        status: 'uploading_events',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
  }

  const { data: draft, error } = await supabaseAdmin
    .from('pending_scores')
    .select('events_data')
    .eq('id', row.pending_score_id)
    .single();
  if (error || !draft) {
    throw new Error(`pending_score not found: ${row.pending_score_id}`);
  }

  const events = draft.events_data as KeyEvent[];
  const buf = Buffer.from(JSON.stringify(events), 'utf-8');

  console.log(
    `[score-cron] uploading events.json (${buf.length} bytes, ${events.length} keys)`,
  );
  const { txId } = await uploadBuffer(buf, 'application/json');

  await supabaseAdmin
    .from('score_nft_queue')
    .update({
      events_ar_tx_id: txId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  console.log(`[score-cron] events uploaded: ${txId}`);
  return 'minting_onchain';
}

// ─────────────────────────────────────────────────
// Step: uploading metadata.json
// ─────────────────────────────────────────────────
export async function stepUploadMetadata(
  row: ScoreMintQueueRow,
): Promise<ScoreMintStatus> {
  if (row.metadata_ar_tx_id) {
    console.log(
      `[score-cron] metadata already uploaded: ${row.metadata_ar_tx_id}`,
    );
    return 'setting_uri';
  }

  if (!row.token_id) {
    throw new Error('token_id missing before metadata step');
  }
  if (!row.events_ar_tx_id) {
    throw new Error('events_ar_tx_id missing before metadata step');
  }

  const { data: track } = await supabaseAdmin
    .from('tracks')
    .select('title, week, arweave_url')
    .eq('id', row.track_id)
    .single();
  if (!track) throw new Error(`track not found: ${row.track_id}`);

  const decoderTxId = process.env.SCORE_DECODER_AR_TX_ID;
  const soundsMapTxId = process.env.SOUNDS_MAP_AR_TX_ID;
  if (!decoderTxId) throw new Error('SCORE_DECODER_AR_TX_ID not configured');
  if (!soundsMapTxId) throw new Error('SOUNDS_MAP_AR_TX_ID not configured');

  // base 参数：优先用 tracks.arweave_url，否则 fallback 到第一首底曲 demo
  const baseArUrl = track.arweave_url
    ? (track.arweave_url as string).replace('https://arweave.net/', 'ar://')
    : 'ar://qwL34NhT4fvuJHO9wLE2AcVwYrooXrkOSNRqiB1DSOE';

  const animationUrl =
    `https://arweave.net/${decoderTxId}` +
    `?events=ar://${row.events_ar_tx_id}` +
    `&base=${encodeURIComponent(baseArUrl)}` +
    `&sounds=ar://${soundsMapTxId}`;

  // 查 events count（用于 attributes）
  const { data: draft } = await supabaseAdmin
    .from('pending_scores')
    .select('events_data')
    .eq('id', row.pending_score_id)
    .single();
  const events = (draft?.events_data as KeyEvent[]) ?? [];

  const metadata: ScoreMetadata = {
    name: `Ripples #${row.token_id}`,
    description:
      `A live jam on "${track.title}" recorded and minted as an on-chain Score NFT. ` +
      `All audio permanently stored on Arweave. Playable in the network-native web player.`,
    image: resolveArUrl(row.cover_ar_tx_id),
    external_url: `https://ripples.example/score/${row.token_id}`,
    animation_url: animationUrl,
    attributes: [
      { trait_type: 'Track', value: track.title },
      { trait_type: 'Week', value: track.week },
      { trait_type: 'Events', value: events.length },
      { trait_type: 'Minted At', value: new Date().toISOString().slice(0, 10) },
    ],
  };

  const buf = Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`[score-cron] uploading metadata.json (${buf.length} bytes)`);
  const { txId } = await uploadBuffer(buf, 'application/json');

  await supabaseAdmin
    .from('score_nft_queue')
    .update({
      metadata_ar_tx_id: txId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  console.log(`[score-cron] metadata uploaded: ${txId}`);
  return 'setting_uri';
}
