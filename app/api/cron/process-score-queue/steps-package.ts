import { attestPermanentResource } from '@/src/lib/permanent-core/attestation';
import {
  SCORE_PACKAGE_SCHEMA, serializeScorePackageV3, type ScorePackageV3,
} from '@/src/lib/score-package';
import { isSoundKey, VALID_SOUND_KEYS } from '@/src/lib/sound-set';
import type { KeyEvent, ScoreMintQueueRow, ScoreMintStatus } from '@/src/types/jam';
import { uploadAndVerifyJson } from './steps-upload';

function requirePinned(row: ScoreMintQueueRow) {
  const fields = [
    row.events_ar_tx_id, row.events_sha256, row.events_bytes, row.events_mime,
    row.base_ar_tx_id, row.base_sha256, row.base_bytes, row.base_mime,
    row.sounds_map_ar_tx_id, row.sounds_map_sha256, row.sounds_map_bytes,
    row.sounds_map_mime, row.decoder_ar_tx_id, row.decoder_sha256,
    row.decoder_bytes, row.decoder_mime,
  ];
  if (fields.some((value) => value === null)) throw new Error('永久闭包 pin 不完整');
  if (row.events_mime !== 'application/json' || row.base_mime !== 'audio/mpeg'
    || row.sounds_map_mime !== 'application/json' || row.decoder_mime !== 'text/html') {
    throw new Error('永久闭包 pin 的 MIME 与资源角色不一致');
  }
  return {
    events: {
      arTxId: row.events_ar_tx_id!, sha256: row.events_sha256!,
      bytes: row.events_bytes!, mime: 'application/json' as const,
    },
    base: {
      arTxId: row.base_ar_tx_id!, sha256: row.base_sha256!,
      bytes: row.base_bytes!, mime: 'audio/mpeg' as const,
    },
    soundSet: {
      arTxId: row.sounds_map_ar_tx_id!, sha256: row.sounds_map_sha256!,
      bytes: row.sounds_map_bytes!, mime: 'application/json' as const,
    },
    decoder: {
      arTxId: row.decoder_ar_tx_id!, sha256: row.decoder_sha256!,
      bytes: row.decoder_bytes!, mime: row.decoder_mime as 'text/html',
    },
  };
}

function manifestKeys(value: unknown): Set<string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('SoundSet manifest 不是对象');
  }
  const record = value as Record<string, unknown>;
  if (record.schema !== 'ripples.sound-set.v1' || record.publicationStatus !== 'published'
    || !Array.isArray(record.keyOrder) || !Array.isArray(record.entries)
    || record.keyOrder.length !== VALID_SOUND_KEYS.length
    || record.entries.length !== VALID_SOUND_KEYS.length) {
    throw new Error('SoundSet manifest schema、发布状态或 33 键数量无效');
  }
  if (record.keyOrder.some((key, index) => key !== VALID_SOUND_KEYS[index])) {
    throw new Error('SoundSet keyOrder 与当前 33 键注册表不一致');
  }
  const keys = new Set<string>();
  for (const valueEntry of record.entries) {
    if (!valueEntry || typeof valueEntry !== 'object') throw new Error('SoundSet entry 无效');
    const entry = valueEntry as Record<string, unknown>;
    if (!isSoundKey(entry.key) || typeof entry.arTxId !== 'string'
      || typeof entry.sha256 !== 'string' || typeof entry.bytes !== 'number'
      || entry.mime !== 'audio/mpeg' || keys.has(entry.key)) {
      throw new Error('SoundSet entry identity 无效或重复');
    }
    keys.add(entry.key);
  }
  return keys;
}

export async function stepPreparePackage(
  row: ScoreMintQueueRow,
  leaseOwner: string,
): Promise<ScoreMintStatus> {
  if (row.events_upload_state !== 'verified') {
    throw new Error('events 尚未双网关验证');
  }
  const resources = requirePinned(row);
  const [eventsBytes, , soundsBytes] = await Promise.all([
    attestPermanentResource(resources.events),
    attestPermanentResource(resources.base),
    attestPermanentResource(resources.soundSet),
    attestPermanentResource(resources.decoder),
  ]);
  const events = JSON.parse(new TextDecoder().decode(eventsBytes)) as KeyEvent[];
  const keys = manifestKeys(JSON.parse(new TextDecoder().decode(soundsBytes)));
  if (!Array.isArray(events) || events.some((event) => !isSoundKey(event.key) || !keys.has(event.key))) {
    throw new Error('events 含未知键或固定 SoundSet 缺键');
  }
  const scorePackage: ScorePackageV3 = {
    schema: SCORE_PACKAGE_SCHEMA,
    queueId: row.id,
    contentId: row.pending_score_id,
    resources,
  };
  const buffer = Buffer.from(serializeScorePackageV3(scorePackage), 'utf-8');
  const verified = await uploadAndVerifyJson(row, leaseOwner, 'package', buffer);
  return verified ? 'minting_onchain' : 'preparing_package';
}
