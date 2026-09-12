import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { serializePondEchoCollectionMetadataV1 } from '../../../src/lib/wallet-recipe/collection-metadata';
import type { ClipManifestV1, P14ClipV1 } from '../../../src/types/wallet-recipe';
import { auditMp3 } from './mp3-audit';
import type { P14AssetKind } from './upload-state';

export const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const MANIFEST_PATH = join(process.cwd(), 'src/features/wallet-recipe/clips-v1.json');
export const TX_ID = /^[A-Za-z0-9_-]{43}$/;

export type P14CliKind = 'clips' | 'decoder' | 'image' | 'collection';
export type P14Asset = {
  kind: P14AssetKind;
  key: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
  sha256: string;
};

export const sha256 = (value: Buffer | string): string =>
  createHash('sha256').update(value).digest('hex');

export function inspectClips(manifest: ClipManifestV1): P14ClipV1[] {
  const directory = join(process.cwd(), 'public/the36');
  const files = readdirSync(directory).filter((name) => name.toLowerCase().endsWith('.mp3'));
  const expected = [...CHARSET].map((key) => `${key}.mp3`);
  if (files.length !== 36 || expected.some((name) => !files.includes(name))
    || files.some((name) => !expected.includes(name))) throw new Error('A–Z、0–9 文件集合不精确');
  return [...CHARSET].map((key, index) => {
    const fileName = `${key}.mp3`;
    const buffer = readFileSync(join(directory, fileName));
    const audio = auditMp3(buffer);
    const next: P14ClipV1 = {
      key, fileName, bytes: buffer.length, mimeType: 'audio/mpeg', sha256: sha256(buffer),
      sampleRate: audio.sampleRate, channels: audio.channels, frameCount: audio.frameCount,
      durationMs: audio.durationMs, arweaveTxId: manifest.clips[index]?.arweaveTxId ?? null,
    };
    const frozen = manifest.clips[index];
    for (const field of ['key', 'fileName', 'bytes', 'mimeType', 'sha256', 'sampleRate',
      'channels', 'frameCount', 'durationMs'] as const) {
      if (next[field] !== frozen?.[field]) throw new Error(`${fileName} 的 ${field} 偏离冻结 manifest`);
    }
    return next;
  });
}

export function buildManifest(
  manifest: ClipManifestV1,
  clips: P14ClipV1[],
): ClipManifestV1 {
  const identity = { version: 1 as const, charset: CHARSET, count: 36 as const, clips };
  return { ...identity, generatedAt: manifest.generatedAt, manifestSha256: sha256(JSON.stringify(identity)) };
}

export function clipAssets(manifest: ClipManifestV1, clips: P14ClipV1[]): P14Asset[] {
  const assets = clips.map((clip): P14Asset => {
    const buffer = readFileSync(join(process.cwd(), 'public/the36', clip.fileName));
    return { kind: 'clip', key: clip.key, fileName: clip.fileName,
      contentType: clip.mimeType, buffer, sha256: clip.sha256 };
  });
  if (clips.every((clip) => TX_ID.test(clip.arweaveTxId ?? ''))) {
    const buffer = Buffer.from(`${JSON.stringify(buildManifest(manifest, clips), null, 2)}\n`);
    assets.push({ kind: 'clip_manifest', key: 'v1', fileName: 'clips-v1.json',
      contentType: 'application/json', buffer, sha256: sha256(buffer) });
  }
  return assets;
}

export function staticAsset(kind: 'decoder' | 'image'): P14Asset {
  const decoder = kind === 'decoder';
  const fileName = decoder ? 'index.html' : 'cover-v1.png';
  const buffer = readFileSync(join(process.cwd(),
    decoder ? 'src/wallet-recipe-decoder' : 'public/pond-echoes', fileName));
  if (decoder) {
    const html = buffer.toString('utf8');
    for (const required of ['v!=="1"', 'recipe.length!==36', 'TIMEOUT=12000', 'FADE=.06']) {
      if (!html.includes(required)) throw new Error(`Decoder 缺少冻结合同：${required}`);
    }
  } else if (!buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    throw new Error('E5 封面不是合法 PNG');
  }
  return { kind, key: kind, fileName,
    contentType: decoder ? 'text/html; charset=utf-8' : 'image/png',
    buffer, sha256: sha256(buffer) };
}

export function collectionAsset(imageTxId: string): P14Asset {
  const buffer = Buffer.from(serializePondEchoCollectionMetadataV1(imageTxId), 'utf8');
  return { kind: 'collection_metadata', key: 'v1', fileName: 'collection-v1.json',
    contentType: 'application/json', buffer, sha256: sha256(buffer) };
}
