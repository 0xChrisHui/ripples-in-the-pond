import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CURRENT_SOUND_SET_ID,
  VALID_SOUND_KEYS,
  type SoundKey,
} from '../../src/lib/sound-set';

export const SOUND_SET_SCHEMA = 'ripples.sound-set.v1' as const;
export const SOUND_SET_SOURCE_COMMIT = 'f7c507b5a07c8fc8a6b36fd0f1baafbe0e3e688c';

export type SoundSetEntry = {
  key: SoundKey;
  localPath: `public/sounds/${SoundKey}.mp3`;
  sha256: string;
  bytes: number;
  durationMs: number;
  mime: 'audio/mpeg';
  arTxId: string | null;
  blobKey: string | null;
};

export type SoundSetLedger = {
  schema: typeof SOUND_SET_SCHEMA;
  id: typeof CURRENT_SOUND_SET_ID;
  sourceCommit: string;
  publicationStatus: 'not-published' | 'published';
  keyOrder: readonly SoundKey[];
  entries: readonly SoundSetEntry[];
};

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function decodeMp3(bytes: Buffer): { durationMs: number } {
  let offset = bytes.subarray(0, 3).toString('ascii') === 'ID3'
    ? 10 + ((bytes[6] & 0x7f) << 21) + ((bytes[7] & 0x7f) << 14)
      + ((bytes[8] & 0x7f) << 7) + (bytes[9] & 0x7f)
    : 0;
  let durationMs = 0;
  let frames = 0;
  while (offset + 4 <= bytes.length) {
    const header = bytes.readUInt32BE(offset);
    if (((header & 0xffe00000) >>> 0) !== 0xffe00000) { offset++; continue; }
    const version = (header >>> 19) & 3;
    const layer = (header >>> 17) & 3;
    const bitrateIndex = (header >>> 12) & 15;
    const sampleIndex = (header >>> 10) & 3;
    if (version === 1 || layer !== 1 || !bitrateIndex || bitrateIndex === 15 || sampleIndex === 3) {
      offset++;
      continue;
    }
    const mpeg1 = version === 3;
    const sampleRate = [44100, 48000, 32000][sampleIndex] / (mpeg1 ? 1 : version === 2 ? 2 : 4);
    const rates = mpeg1
      ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
      : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const frameBytes = Math.floor((mpeg1 ? 144 : 72) * rates[bitrateIndex] * 1000 / sampleRate)
      + ((header >>> 9) & 1);
    if (frameBytes < 4 || offset + frameBytes > bytes.length) break;
    durationMs += (mpeg1 ? 1152 : 576) / sampleRate * 1000;
    frames++;
    offset += frameBytes;
  }
  if (!frames) throw new Error('MP3 中没有可解码帧');
  return { durationMs: Math.round(durationMs) };
}

export function inspectSoundDirectory(root: string): SoundSetEntry[] {
  const soundDir = join(root, 'public', 'sounds');
  const actual = readdirSync(soundDir).filter((name) => name.endsWith('.mp3')).sort();
  const expected = VALID_SOUND_KEYS.map((key) => `${key}.mp3`).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`声音目录必须精确包含 33 个文件；实际 ${actual.length} 个`);
  }
  return VALID_SOUND_KEYS.map((key) => {
    const bytes = readFileSync(join(soundDir, `${key}.mp3`));
    return {
      key,
      localPath: `public/sounds/${key}.mp3`,
      sha256: sha256(bytes),
      bytes: bytes.length,
      durationMs: decodeMp3(bytes).durationMs,
      mime: 'audio/mpeg',
      arTxId: null,
      blobKey: null,
    };
  });
}

export function buildSoundSetLedger(root: string): SoundSetLedger {
  return {
    schema: SOUND_SET_SCHEMA,
    id: CURRENT_SOUND_SET_ID,
    sourceCommit: SOUND_SET_SOURCE_COMMIT,
    publicationStatus: 'not-published',
    keyOrder: VALID_SOUND_KEYS,
    entries: inspectSoundDirectory(root),
  };
}

export function validateSoundSetLedger(
  ledger: SoundSetLedger,
  observed: readonly SoundSetEntry[],
  p9Keys: readonly string[],
): string[] {
  const errors: string[] = [];
  const expected = [...VALID_SOUND_KEYS];
  const ledgerKeys = ledger.entries.map(({ key }) => key);
  const duplicateKeys = ledgerKeys.filter((key, index) => ledgerKeys.indexOf(key) !== index);
  if (ledger.schema !== SOUND_SET_SCHEMA || ledger.id !== CURRENT_SOUND_SET_ID) errors.push('账本版本错误');
  if (JSON.stringify(ledger.keyOrder) !== JSON.stringify(expected)) errors.push('规范键序错误');
  if (new Set(ledgerKeys).size !== 33 || ledgerKeys.length !== 33) errors.push('账本必须有 33 个唯一键');
  if (duplicateKeys.length) errors.push(`账本存在重复键：${[...new Set(duplicateKeys)].join(',')}`);
  const observedByKey = new Map(observed.map((entry) => [entry.key, entry]));
  for (const entry of ledger.entries) {
    const local = observedByKey.get(entry.key);
    if (!local) { errors.push(`缺少声音文件：${entry.key}`); continue; }
    if (entry.localPath !== `public/sounds/${entry.key}.mp3`) errors.push(`本地路径错误：${entry.key}`);
    if (entry.sha256 !== local.sha256) errors.push(`声音 hash 漂移：${entry.key}`);
    if (entry.bytes !== local.bytes || entry.durationMs !== local.durationMs) errors.push(`声音身份漂移：${entry.key}`);
    if (entry.mime !== 'audio/mpeg' || entry.durationMs <= 0) errors.push(`声音格式错误：${entry.key}`);
    const validTx = entry.arTxId === null || /^[A-Za-z0-9_-]{43}$/.test(entry.arTxId);
    if (!validTx) errors.push(`AR txid 非法：${entry.key}`);
    const expectedBlob = entry.arTxId === null ? null : `media/${entry.arTxId}`;
    if (entry.blobKey !== expectedBlob) errors.push(`Blob key 与 AR txid 不一致：${entry.key}`);
  }
  const p9Unique = [...new Set(p9Keys)];
  if (p9Keys.length !== 33 || p9Unique.length !== 33) errors.push('P9 必须有 33 个唯一声音键');
  if (JSON.stringify([...p9Unique].sort()) !== JSON.stringify([...expected].sort())) errors.push('P9 声音键映射有缺口');
  return errors;
}
