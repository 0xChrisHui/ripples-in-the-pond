/**
 * P22 素材身份表生成：音效按音频 SHA-256 去重后顺序编号，背景音乐按 catalog 顺序编号。
 * 只追加不重排：已有 asset-map.json 时保留旧编号，新增项接在末尾。
 * 历史（旧）音效 SHA-256 通过 --extra-sha <hex> 追加（P22-B 盘点两链 Score 后补）。
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { VALID_SOUND_KEYS } from '../../src/lib/sound-set';

const OUT = path.resolve('src/lib/score-pack/data/asset-map.json');
type TrackEntry = { id: number; catalogId: string };
type AssetMap = { sounds: Record<string, number>; tracks: Record<string, TrackEntry> };

const prev: AssetMap = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, 'utf8')) as AssetMap : { sounds: {}, tracks: {} };
const sounds = { ...prev.sounds };
let nextSound = Math.max(0, ...Object.values(sounds)) + 1;

function addSound(sha: string) {
  if (!/^[0-9a-f]{64}$/.test(sha)) throw new Error(`非法 sha256：${sha}`);
  if (sounds[sha] === undefined) sounds[sha] = nextSound++;
}

for (const key of VALID_SOUND_KEYS) {
  const bytes = readFileSync(path.resolve(`public/sounds/${key}.mp3`));
  addSound(createHash('sha256').update(bytes).digest('hex'));
}
process.argv.forEach((arg, i) => { if (arg === '--extra-sha') addSound(process.argv[i + 1]); });

const catalog = JSON.parse(readFileSync(
  path.resolve('src/lib/music-catalog/data/tracks-source.json'), 'utf8',
)) as Array<{ id: string; arweave_url: string; week: number }>;
const tracks = { ...prev.tracks };
let nextTrack = Math.max(0, ...Object.values(tracks).map((t) => t.id)) + 1;
for (const item of [...catalog].sort((a, b) => a.week - b.week)) {
  const txId = item.arweave_url.split('/').pop() ?? '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(txId)) throw new Error(`曲目 ${item.id} 的 Arweave 地址无效`);
  if (!tracks[txId]) tracks[txId] = { id: nextTrack++, catalogId: item.id };
}

writeFileSync(OUT, `${JSON.stringify({ sounds, tracks }, null, 2)}\n`);
console.log(`音效 ${Object.keys(sounds).length} 个，背景音乐 ${Object.keys(tracks).length} 首 → ${OUT}`);
