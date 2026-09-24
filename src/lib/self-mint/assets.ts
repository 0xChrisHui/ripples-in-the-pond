import 'server-only';

import { uploadBuffer, resolveArUrl } from '@/src/lib/arweave';
import { attestPermanentResource } from '@/src/lib/permanent-core/attestation';
import {
  SCORE_PACKAGE_SCHEMA,
  serializeScorePackageV3,
  sha256Hex,
  type ScorePackageV3,
} from '@/src/lib/score-package';
import { isSoundKey } from '@/src/lib/sound-set';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { KeyEvent } from '@/src/types/jam';
import type { ScoreMetadata } from '@/src/types/score-mint';
import { buildScoreRoute } from '../chain/multichain/registry';
import type { SelfMintOrderRow, UploadState } from './order';

type UploadKind = 'events' | 'package' | 'metadata';
type UploadIdentity = { sha256: string; bytes: number; mime: 'application/json' };

function uploadFields(row: SelfMintOrderRow, kind: UploadKind) {
  return {
    state: row[`${kind}_upload_state`],
    txId: row[`${kind}_ar_tx_id`],
    sha256: row[`${kind}_sha256`],
    bytes: row[`${kind}_bytes`],
    mime: row[`${kind}_mime`],
  };
}

async function writeUpload(
  row: SelfMintOrderRow,
  owner: string,
  kind: UploadKind,
  identity: UploadIdentity,
  state: Exclude<UploadState, 'none'>,
  txId: string | null = null,
  lastError: string | null = null,
) {
  const { data, error } = await supabaseAdmin.rpc('write_score_self_mint_upload_state', {
    p_order_id: row.id,
    p_lease_owner: owner,
    p_kind: kind,
    p_content_sha256: identity.sha256,
    p_bytes: identity.bytes,
    p_mime: identity.mime,
    p_state: state,
    p_arweave_tx_id: txId,
    p_last_error: lastError,
  });
  if (error) throw error;
  return data === true;
}

async function uploadAndVerify(
  row: SelfMintOrderRow,
  owner: string,
  kind: UploadKind,
  bytes: Buffer,
): Promise<boolean> {
  const identity: UploadIdentity = {
    sha256: await sha256Hex(bytes), bytes: bytes.length, mime: 'application/json',
  };
  const stored = uploadFields(row, kind);
  if (stored.state !== 'none' && (stored.sha256 !== identity.sha256
    || stored.bytes !== identity.bytes || stored.mime !== identity.mime)) {
    throw new Error(`CRITICAL: ${kind} 固定内容与重建内容不一致`);
  }
  if (stored.state === 'uploading' || stored.state === 'upload_result_unknown') {
    throw new Error(`CRITICAL: ${kind} 上传结果未知，禁止盲重传`);
  }
  if (stored.state === 'verified') return true;
  if (stored.state === 'uploaded' && stored.txId) {
    try {
      await attestPermanentResource({ arTxId: stored.txId, ...identity });
      return writeUpload(row, owner, kind, identity, 'verified', stored.txId);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('永久资源未达到双网关 quorum')) {
        return false;
      }
      throw new Error(`CRITICAL: ${kind} 永久资源身份冲突`, { cause: error });
    }
  }
  if (stored.state !== 'none') throw new Error(`CRITICAL: ${kind} 上传状态损坏`);
  if (!await writeUpload(row, owner, kind, identity, 'uploading')) return false;
  try {
    const uploaded = await uploadBuffer(bytes, identity.mime, [
      { name: 'App-Name', value: 'Ripples-in-the-Pond' },
      { name: 'Resource-Kind', value: `ethereum-score-${kind}` },
      { name: 'Content-SHA256', value: identity.sha256 },
    ]);
    if (!await writeUpload(row, owner, kind, identity, 'uploaded', uploaded.txId)) {
      throw new Error(`${kind} 已上传但数据库回写失败`);
    }
    const turboFinalized = uploaded.dataCaches.length > 0
      && uploaded.fastFinalityIndexes.length > 0;
    return turboFinalized
      ? writeUpload(row, owner, kind, identity, 'verified', uploaded.txId)
      : false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeUpload(row, owner, kind, identity, 'upload_result_unknown', null, message.slice(0, 2000))
      .catch(() => undefined);
    throw error;
  }
}

async function draftEvents(row: SelfMintOrderRow): Promise<KeyEvent[]> {
  const { data, error } = await supabaseAdmin.from('pending_scores')
    .select('events_data').eq('id', row.pending_score_id).eq('user_id', row.user_id).single();
  const events = data?.events_data as KeyEvent[] | undefined;
  if (error || !events || events.some((event) => !isSoundKey(event.key))) {
    throw new Error('待铸造乐谱事件不存在或含未知按键');
  }
  return events;
}

async function buildAsset(row: SelfMintOrderRow): Promise<{ kind: UploadKind; bytes: Buffer }> {
  const events = await draftEvents(row);
  if (row.events_upload_state !== 'verified') {
    return { kind: 'events', bytes: Buffer.from(JSON.stringify(events), 'utf8') };
  }
  if (row.package_upload_state !== 'verified') {
    const scorePackage: ScorePackageV3 = {
      schema: SCORE_PACKAGE_SCHEMA,
      queueId: row.id,
      contentId: row.pending_score_id,
      resources: {
        events: { arTxId: row.events_ar_tx_id!, sha256: row.events_sha256!, bytes: row.events_bytes!, mime: 'application/json' },
        base: { arTxId: row.base_ar_tx_id, sha256: row.base_sha256, bytes: row.base_bytes, mime: 'audio/mpeg' },
        soundSet: { arTxId: row.sounds_map_ar_tx_id, sha256: row.sounds_map_sha256, bytes: row.sounds_map_bytes, mime: 'application/json' },
        decoder: { arTxId: row.decoder_ar_tx_id, sha256: row.decoder_sha256, bytes: row.decoder_bytes, mime: 'text/html' },
      },
    };
    return { kind: 'package', bytes: Buffer.from(serializeScorePackageV3(scorePackage), 'utf8') };
  }
  const { data: track, error } = await supabaseAdmin.from('tracks')
    .select('title,week').eq('id', row.track_id).single();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (error || !track || !appUrl) throw new Error('曲目或站点配置不完整');
  const metadata: ScoreMetadata = {
    name: `Ripples #${row.token_id}`,
    description: `A live jam on "${track.title}" recorded and minted as an on-chain Score NFT. All audio permanently stored on Arweave.`,
    image: resolveArUrl(row.cover_ar_tx_id),
    external_url: `${appUrl}${buildScoreRoute(row.chain_id, row.score_contract, row.token_id)}`,
    animation_url: `https://arweave.net/${row.decoder_ar_tx_id}?package=ar://${row.package_ar_tx_id}`,
    attributes: [
      { trait_type: 'Track', value: track.title },
      { trait_type: 'Week', value: track.week },
      { trait_type: 'Events', value: events.length },
      { trait_type: 'Minted At', value: row.created_at.slice(0, 10) },
      { trait_type: 'Chain ID', value: row.chain_id },
    ],
    properties: { playback: {
      schema: SCORE_PACKAGE_SCHEMA,
      package: `ar://${row.package_ar_tx_id!}`,
      sha256: row.package_sha256!, bytes: row.package_bytes!, mime: 'application/json',
    } },
  };
  return { kind: 'metadata', bytes: Buffer.from(JSON.stringify(metadata), 'utf8') };
}

export async function processSelfMintAsset(row: SelfMintOrderRow, owner: string) {
  const asset = await buildAsset(row);
  return { kind: asset.kind, verified: await uploadAndVerify(row, owner, asset.kind, asset.bytes) };
}
