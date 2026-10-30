/**
 * P22-B 素材 metadata 生成（只写本地文件，不上传）。
 * 音效/背景音乐的音频都复用已有 Arweave 文件；这里只生成每个 tokenId 的 ERC-1155 metadata JSON。
 * 用法：tsx scripts/p22/build-asset-metadata.ts <输出目录> [--sound-image ar://… --track-image ar://…]
 * 图片未提供时写入占位值并在汇总里报警，占位 metadata 不得上传。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type AssetMap = { sounds: Record<string, number>; tracks: Record<string, { id: number; catalogId: string }> };
type LedgerAsset = { kind: string; key: string; contentSha256: string; arweaveTxId: string; state: string; bytes: number };

const outDir = process.argv[2];
if (!outDir) throw new Error('用法：build-asset-metadata.ts <输出目录>');
const arg = (name: string) => {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : null;
};
const PLACEHOLDER = 'ar://__IMAGE_NOT_SET__';
const soundImage = arg('--sound-image') ?? PLACEHOLDER;
const trackImage = arg('--track-image') ?? PLACEHOLDER;
const TX = /^[A-Za-z0-9_-]{43}$/;

const map = JSON.parse(readFileSync(path.resolve('src/lib/score-pack/data/asset-map.json'), 'utf8')) as AssetMap;
const ledger = JSON.parse(readFileSync(path.resolve('data/sound-sets/current-33-upload-ledger.json'), 'utf8')) as {
  assets: Record<string, LedgerAsset>;
};
const catalog = JSON.parse(readFileSync(path.resolve('src/lib/music-catalog/data/tracks-source.json'), 'utf8')) as Array<{
  id: string; title: string; week: number; arweave_url: string;
}>;

function write(kind: string, id: number, body: unknown) {
  const dir = path.join(outDir, kind);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${id}.json`), `${JSON.stringify(body, null, 2)}\n`);
}

let sounds = 0;
for (const asset of Object.values(ledger.assets)) {
  if (asset.kind !== 'sound' || asset.state !== 'verified' || !asset.key || !TX.test(asset.arweaveTxId)) continue;
  const id = map.sounds[asset.contentSha256];
  if (id === undefined) throw new Error(`音效 ${asset.key} 不在映射表`);
  write('sounds', id, {
    name: `Ripples Pond Sound · ${asset.key}`,
    description: 'A sound from the Ripples in the Pond keyboard. Soulbound: it lives inside a Score\'s token-bound account and cannot be transferred on its own.',
    image: soundImage,
    animation_url: `ar://${asset.arweaveTxId}`,
    attributes: [
      { trait_type: 'Key', value: asset.key },
      { trait_type: 'SHA-256', value: asset.contentSha256 },
    ],
  });
  sounds += 1;
}

let tracks = 0;
for (const item of catalog) {
  const txId = item.arweave_url.split('/').pop() ?? '';
  const entry = map.tracks[txId];
  if (!entry || !TX.test(txId)) throw new Error(`曲目 ${item.id} 不在映射表`);
  write('tracks', entry.id, {
    name: `Ripples Pond Track · ${item.title}`,
    description: 'A background track from Ripples in the Pond. Soulbound: it lives inside a Score\'s token-bound account and cannot be transferred on its own.',
    image: trackImage,
    animation_url: `ar://${txId}`,
    attributes: [{ trait_type: 'Week', value: item.week }],
  });
  tracks += 1;
}

console.log(`音效 metadata ${sounds}/${Object.keys(map.sounds).length}，背景音乐 metadata ${tracks}/${Object.keys(map.tracks).length} → ${outDir}`);
if (soundImage === PLACEHOLDER || trackImage === PLACEHOLDER) {
  console.log('!! 图片尚未提供，当前为占位值，不得上传。');
}
if (sounds !== Object.keys(map.sounds).length || tracks !== Object.keys(map.tracks).length) process.exitCode = 1;
