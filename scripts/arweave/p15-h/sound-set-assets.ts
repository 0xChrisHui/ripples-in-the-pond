import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { VALID_SOUND_KEYS, type SoundKey } from '../../../src/lib/sound-set';
import {
  inspectSoundDirectory, sha256, validateSoundSetLedger,
  type SoundSetLedger,
} from '../../p15-h/sound-set-ledger';
import type { H3UploadLedger } from './upload-state';

export type H3Asset = {
  kind: 'sound' | 'manifest';
  key: string;
  fileName: string;
  contentType: 'audio/mpeg' | 'application/json';
  buffer: Buffer;
  sha256: string;
};

const ROOT = process.cwd();
const REGISTRY_PATH = join(ROOT, 'data', 'sound-sets', 'current-33.json');
const LEGACY_HASHES = [
  ['data/sounds-ar-map.json', '5c83f176785934aca0bf36f12ad195e4141c0e309e6c0e12ab8b2b5e8b480e3e'],
  ['data/sounds-map-ar.json', '13c9c018690ce5190b309e7f3405e2c2af3db4e49faceca2c7ca69bd05cf1cbd'],
] as const;

export function readCurrentRegistry(): SoundSetLedger {
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as SoundSetLedger;
  const observed = inspectSoundDirectory(ROOT);
  const errors = validateSoundSetLedger(registry, observed, VALID_SOUND_KEYS);
  if (errors.length) throw new Error(`current-33 注册表校验失败：\n- ${errors.join('\n- ')}`);
  for (const [path, expected] of LEGACY_HASHES) {
    const normalized = readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n');
    if (sha256(Buffer.from(normalized)) !== expected) throw new Error(`历史 26 键档案已变化：${path}`);
  }
  return registry;
}

export function soundAssets(registry: SoundSetLedger): H3Asset[] {
  return registry.entries.map((entry) => {
    const buffer = readFileSync(join(ROOT, entry.localPath));
    if (buffer.length !== entry.bytes || sha256(buffer) !== entry.sha256) {
      throw new Error(`${entry.key} 本地字节偏离 current-33 注册表`);
    }
    return {
      kind: 'sound', key: entry.key, fileName: `${entry.key}.mp3`,
      contentType: 'audio/mpeg', buffer, sha256: entry.sha256,
    };
  });
}

function manifestObject(registry: SoundSetLedger, txIdOf: (key: SoundKey) => string) {
  const entries = registry.entries.map((entry) => ({
    key: entry.key,
    arTxId: txIdOf(entry.key),
    sha256: entry.sha256,
    bytes: entry.bytes,
    durationMs: entry.durationMs,
    mime: entry.mime,
  }));
  return {
    schema: 'ripples.sound-set.v1',
    id: registry.id,
    sourceCommit: registry.sourceCommit,
    publicationStatus: 'published',
    keyOrder: registry.keyOrder,
    entries,
  };
}

export function estimateManifestBytes(registry: SoundSetLedger): number {
  const json = manifestObject(registry, () => 'A'.repeat(43));
  return Buffer.byteLength(`${JSON.stringify(json, null, 2)}\n`);
}

export function manifestAsset(registry: SoundSetLedger, ledger: H3UploadLedger): H3Asset {
  const txIdOf = (key: SoundKey): string => {
    const item = ledger.assets[`sound:${key}`];
    if (item?.state !== 'verified' || !item.arweaveTxId) {
      throw new Error(`manifest 必须等待 ${key} 双网关 verified`);
    }
    return item.arweaveTxId;
  };
  const buffer = Buffer.from(`${JSON.stringify(manifestObject(registry, txIdOf), null, 2)}\n`);
  if (buffer.length > 65536) throw new Error(`声音 manifest 超过 64KB：${buffer.length}`);
  return {
    kind: 'manifest', key: registry.id, fileName: `${registry.id}.json`,
    contentType: 'application/json', buffer, sha256: sha256(buffer),
  };
}

function saveRegistry(registry: SoundSetLedger): void {
  const temporary = `${REGISTRY_PATH}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  renameSync(temporary, REGISTRY_PATH);
}

export function freezeVerifiedSound(
  registry: SoundSetLedger,
  key: SoundKey,
  txId: string,
): void {
  const entry = registry.entries.find((candidate) => candidate.key === key);
  if (!entry) throw new Error(`注册表缺少声音键：${key}`);
  if (entry.arTxId !== null && entry.arTxId !== txId) throw new Error(`${key} 的永久 txid 冲突`);
  entry.arTxId = txId;
  registry.publicationStatus = 'publishing';
  saveRegistry(registry);
}

export function freezeVerifiedManifest(
  registry: SoundSetLedger,
  asset: H3Asset,
  txId: string,
): void {
  if (registry.entries.some(({ arTxId }) => arTxId === null)) throw new Error('33 个声音尚未全部冻结');
  registry.manifest = {
    arTxId: txId, sha256: asset.sha256, bytes: asset.buffer.length, mime: 'application/json',
  };
  registry.publicationStatus = 'published';
  saveRegistry(registry);
}
