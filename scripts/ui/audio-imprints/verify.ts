import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import { getTrackImprint } from '../../../src/lib/music-catalog/experience/imprints';

type Imprint = { durationSeconds: number; envelope: number[]; texture: number[]; sha256: string };
const output = 'src/lib/music-catalog/experience/track-imprints.json';
assert.ok(existsSync(output), '真实曲目特征尚未生成');
const data = JSON.parse(readFileSync(output, 'utf8')) as {
  schema: string; analysis: { sampleRate: number; samples: number; quantization: number }; tracks: Record<string, Imprint>;
};
const evidence = JSON.parse(readFileSync('reviews/evidence/p15-h/h7-track-bases.json', 'utf8')) as {
  tracks: { id: string; week: number; sha256: string }[];
};
const catalog = getMusicCatalog();
assert.equal(data.schema, 'ripples.track-imprints.v1');
assert.equal(data.analysis.samples, 96);
assert.equal(data.analysis.sampleRate, 22050);
assert.equal(data.analysis.quantization, 255);
assert.equal(catalog.tracks.length, 35);
assert.deepEqual(Object.keys(data.tracks).sort(), catalog.tracks.map((track) => track.trackId).sort());
const signatures = new Set<string>();
const durations: number[] = [];
const probe = process.env.FFPROBE_PATH ?? (process.env.FFMPEG_PATH
  ? join(dirname(process.env.FFMPEG_PATH), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe') : 'ffprobe');

for (const track of catalog.tracks) {
  const stored = data.tracks[track.trackId];
  const imprint = getTrackImprint(track.trackId);
  assert.ok(imprint);
  const path = `public/tracks/No.${track.displayNumber}.mp3`;
  const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
  const proof = evidence.tracks.find((item) => item.id === track.trackId);
  assert.equal(proof?.week, track.displayNumber);
  assert.equal(hash, proof?.sha256, `曲目 ${track.displayNumber} 与 H7 永久来源不一致`);
  assert.equal(imprint.sha256, hash);
  assert.equal(stored.durationSeconds, imprint.durationSeconds);
  for (const vector of [stored.envelope, stored.texture]) {
    assert.ok(vector.every((value) => Number.isInteger(value) && value >= 0 && value <= 255));
  }
  assert.ok(Number.isFinite(imprint.durationSeconds) && imprint.durationSeconds > 0);
  for (const vector of [imprint.envelope, imprint.texture]) {
    assert.equal(vector.length, 96);
    assert.ok(vector.every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
    assert.ok(Math.max(...vector) > Math.min(...vector), `曲目 ${track.displayNumber} 缺少真实变化`);
    assert.equal(Math.max(...vector), 1);
  }
  const result = spawnSync(probe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', path], {
    encoding: 'utf8', windowsHide: true,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  const duration = Number((JSON.parse(result.stdout) as { format: { duration: string } }).format.duration);
  // MP3 容器包含编码器填充；解码音频长度应只相差少量帧。
  assert.ok(Math.abs(duration - imprint.durationSeconds) < 0.1, `曲目 ${track.displayNumber} 时长异常`);
  durations.push(imprint.durationSeconds);
  signatures.add(JSON.stringify(imprint.envelope));
}
assert.equal(signatures.size, 35, '不同曲目的包络不能复用同一份数据');
for (const unknownId of ['未注册曲目', '__proto__', 'constructor']) assert.equal(getTrackImprint(unknownId), null);
const firstId = catalog.tracks[0].trackId;
const first = getTrackImprint(firstId)!;
const original = first.envelope[0];
first.envelope[0] = -1;
assert.equal(getTrackImprint(firstId)?.envelope[0], original, '消费方不能污染静态特征');
console.log(`35/35 曲目、H7 来源哈希、真实时长及 96 段 RMS/过零纹理均通过；时长 ${Math.min(...durations)}–${Math.max(...durations)} 秒。`);
