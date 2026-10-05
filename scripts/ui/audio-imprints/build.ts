import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import type { TrackImprint } from '../../../src/lib/music-catalog/experience/imprints';
import { analyzePcm, decodeTrack, SAMPLE_COUNT, SAMPLE_RATE } from './pcm';

const evidence = JSON.parse(readFileSync('reviews/evidence/p15-h/h7-track-bases.json', 'utf8')) as {
  tracks: { id: string; week: number; sha256: string }[];
};
const catalog = getMusicCatalog();
assert.equal(catalog.tracks.length, 35, '本轮特征必须覆盖全部 35 首注册曲目');
const tracks: Record<string, TrackImprint> = {};
for (const track of catalog.tracks) {
  const path = `public/tracks/No.${track.displayNumber}.mp3`;
  const sha256 = createHash('sha256').update(readFileSync(path)).digest('hex');
  const source = evidence.tracks.find((item) => item.id === track.trackId);
  assert.equal(source?.week, track.displayNumber);
  assert.equal(sha256, source?.sha256, `曲目 ${track.displayNumber} 与已核验永久来源不一致`);
  const features = analyzePcm(decodeTrack(path));
  tracks[track.trackId] = {
    durationSeconds: features.durationSeconds,
    envelope: features.envelope.map((value) => Math.round(value * 255)),
    texture: features.texture.map((value) => Math.round(value * 255)),
    sha256,
  };
}

const analysis = {
  sampleRate: SAMPLE_RATE, samples: SAMPLE_COUNT, channelMode: 'mono',
  envelope: 'rms_peak_normalized', texture: 'zero_crossing_peak_normalized',
  quantization: 255,
};
// 每首一行，数据只绑定注册表 ID 与原文件哈希，不维护另一份曲目地址。
const rows = Object.entries(tracks).map(([id, imprint]) => `    ${JSON.stringify(id)}: ${JSON.stringify(imprint)}`);
const json = `{
  "schema": "ripples.track-imprints.v1",
  "analysis": ${JSON.stringify(analysis)},
  "tracks": {
${rows.join(',\n')}
  }
}\n`;
mkdirSync('src/lib/music-catalog/experience', { recursive: true });
writeFileSync('src/lib/music-catalog/experience/track-imprints.json', json);
console.log(`已从 35 个真实 MP3 生成时长、${SAMPLE_COUNT} 段 RMS 包络与过零纹理。`);
