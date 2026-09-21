import { supabaseAdmin } from '@/src/lib/supabase';
import { uploadBuffer, resolveArUrl } from '@/src/lib/arweave';
import { attestPermanentResource } from '@/src/lib/permanent-core/attestation';
import { sha256Hex } from '@/src/lib/score-package';
import { isSoundKey } from '@/src/lib/sound-set';
import type {
  ScoreMintQueueRow, ScoreMintStatus, ScoreMetadata, KeyEvent,
} from '@/src/types/jam';
import { UPLOAD_COLUMNS, writeUploadState, type UploadKind } from './_shared';

const JSON_MIME = 'application/json';

function existingValue<T>(row: ScoreMintQueueRow, key: keyof ScoreMintQueueRow): T {
  return row[key] as T;
}

/** 先落上传意图；结果不明时熔断，绝不靠“同内容同 txid”的错误假设重传。 */
export async function uploadAndVerifyJson(
  row: ScoreMintQueueRow,
  leaseOwner: string,
  kind: UploadKind,
  buffer: Buffer,
): Promise<boolean> {
  const columns = UPLOAD_COLUMNS[kind];
  const identity = { sha256: await sha256Hex(buffer), bytes: buffer.length, mime: JSON_MIME };
  const state = existingValue<string>(row, columns.state);
  const txId = existingValue<string | null>(row, columns.tx);
  const stored = {
    sha256: existingValue<string | null>(row, columns.sha),
    bytes: existingValue<number | null>(row, columns.bytes),
    mime: existingValue<string | null>(row, columns.mime),
  };
  if (state !== 'none' && (stored.sha256 !== identity.sha256
    || stored.bytes !== identity.bytes || stored.mime !== identity.mime)) {
    throw new Error(`CRITICAL: ${kind} 固定内容与重建内容不一致，manual review`);
  }
  if (state === 'upload_result_unknown' || state === 'uploading') {
    throw new Error(`CRITICAL: ${kind} 上传结果未知，禁止盲重传，manual review`);
  }
  if (state === 'verified') return true;
  if (state === 'uploaded' && txId) {
    await attestPermanentResource({ arTxId: txId, ...identity });
    if (!await writeUploadState(row.id, leaseOwner, kind, identity, 'verified', txId)) {
      return false;
    }
    return true;
  }
  if (state !== 'none') throw new Error(`CRITICAL: ${kind} 上传状态损坏：${state}`);

  if (!await writeUploadState(row.id, leaseOwner, kind, identity, 'uploading')) return false;
  let uploadedTxId: string;
  try {
    uploadedTxId = (await uploadBuffer(buffer, JSON_MIME, [
      { name: 'App-Name', value: 'Ripples-in-the-Pond' },
      { name: 'Resource-Kind', value: `score-${kind}` },
      { name: 'Content-SHA256', value: identity.sha256 },
    ])).txId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeUploadState(row.id, leaseOwner, kind, identity, 'upload_result_unknown', undefined, message);
    throw new Error(`CRITICAL: ${kind} 上传返回失败且结果未知，manual review`);
  }
  if (!await writeUploadState(row.id, leaseOwner, kind, identity, 'uploaded', uploadedTxId)) {
    throw new Error(`CRITICAL: ${kind} 已上传 ${uploadedTxId} 但数据库回写失败，manual review`);
  }
  return false;
}

export async function stepUploadEvents(
  row: ScoreMintQueueRow,
  leaseOwner: string,
): Promise<ScoreMintStatus> {
  const { data: draft, error } = await supabaseAdmin.from('pending_scores')
    .select('events_data').eq('id', row.pending_score_id).single();
  if (error || !draft) throw new Error(`pending_score not found: ${row.pending_score_id}`);
  const events = draft.events_data as KeyEvent[];
  if (!Array.isArray(events) || events.some((event) => !isSoundKey(event.key))) {
    throw new Error('录制事件包含不属于当前 33 键注册表的按键');
  }
  const verified = await uploadAndVerifyJson(
    row, leaseOwner, 'events', Buffer.from(JSON.stringify(events), 'utf-8'),
  );
  return verified ? 'preparing_package' : 'uploading_events';
}

export async function stepUploadMetadata(
  row: ScoreMintQueueRow,
  leaseOwner: string,
): Promise<ScoreMintStatus> {
  if (!row.token_id || !row.package_ar_tx_id || !row.decoder_ar_tx_id) {
    throw new Error('metadata 前缺少 token、package 或 decoder identity');
  }
  const { data: track } = await supabaseAdmin.from('tracks')
    .select('title, week').eq('id', row.track_id).single();
  if (!track) throw new Error(`track not found: ${row.track_id}`);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not configured');
  const metadata: ScoreMetadata = {
    name: `Ripples #${row.token_id}`,
    description: `A live jam on "${track.title}" recorded and minted as an on-chain Score NFT. All audio permanently stored on Arweave.`,
    image: resolveArUrl(row.cover_ar_tx_id),
    external_url: `${appUrl}/score/${row.token_id}`,
    animation_url: `https://arweave.net/${row.decoder_ar_tx_id}?package=ar://${row.package_ar_tx_id}`,
    attributes: [
      { trait_type: 'Track', value: track.title },
      { trait_type: 'Week', value: track.week },
      { trait_type: 'Minted At', value: row.created_at.slice(0, 10) },
    ],
    properties: {
      playback: {
        schema: 'ripples.score-package.v3', package: `ar://${row.package_ar_tx_id}`,
        sha256: row.package_sha256!, bytes: row.package_bytes!, mime: JSON_MIME,
      },
    },
  };
  const verified = await uploadAndVerifyJson(
    row, leaseOwner, 'metadata', Buffer.from(JSON.stringify(metadata), 'utf-8'),
  );
  return verified ? 'setting_uri' : 'uploading_metadata';
}
