import assert from 'node:assert/strict';
import test from 'node:test';
import { getTrackAudioSources, playTrackSources, prepareTrackAudio } from '../../../src/components/player/track-audio';
import { toPlayerTrack } from '../../../src/lib/music-catalog/player-adapter';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import proof from '../../../src/lib/music-catalog/experience/audio-stream-proof.json';

test('35首原曲复用同源静态音频，逐字节匹配已核验永久来源', () => {
  process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL = 'https://media.example.test/media';
  for (const track of getMusicCatalog().tracks) {
    const sources = getTrackAudioSources(toPlayerTrack(track.trackId));
    const row = proof.rows.find(row => row.trackId === track.trackId)!;
    assert.equal(row.ref, track.audioArUri);
    const bytes = readFileSync(`public${row.path}`);
    assert.equal(bytes.byteLength, row.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
    assert.equal(sources[0], `${row.path}?v=${row.sha256}`);
    assert.ok(sources.slice(1).every(source => source.endsWith(track.audioArUri!.slice(5))));
  }
});

test('点击复用已预载的同一音频，不重新赋src或load', async () => {
  let loads = 0; let plays = 0;
  const audio = { src: '', error: null, load() { loads++; }, pause() {}, async play() { plays++; } };
  prepareTrackAudio(audio, ['https://media.example.test/a']);
  prepareTrackAudio(audio, ['https://media.example.test/a']);
  assert.equal(loads, 1);
  assert.equal(await playTrackSources(audio, [audio.src], () => true), audio.src);
  assert.equal(loads, 1); assert.equal(plays, 1);
});

test('慢候选有界回退，取消后的旧请求不覆盖新音源', async () => {
  const visited: string[] = [];
  const audio = { src: '', error: null, load() {}, pause() {}, play() {
    visited.push(this.src); return this.src === 'slow' ? new Promise<void>(() => {}) : Promise.resolve();
  } };
  assert.equal(await playTrackSources(audio, ['slow', 'good'], () => true, 20), 'good');
  assert.deepEqual(visited, ['slow', 'good']);
  let current = true;
  const stale = playTrackSources(audio, ['slow', 'good'], () => current, 20);
  current = false; audio.src = 'new';
  assert.equal(await stale, null); assert.equal(audio.src, 'new');
});

test('全部首声超时即使没有原生MediaError，也明确报告一次失败', async () => {
  const failures: Error[] = [];
  const audio = { src: '', error: null, load() {}, pause() {}, play: () => new Promise<void>(() => {}) };
  await assert.rejects(playTrackSources(audio, ['a', 'b', 'c', 'd'], () => true, 5,
    error => failures.push(error)), /音频首声等待超时/);
  assert.equal(audio.error, null);
  assert.equal(failures.length, 1);
  assert.match(failures[0].message, /音频首声等待超时/);
});

test('成功回退和取消旧切歌请求都不会报告播放失败', async () => {
  const failures: Error[] = [];
  const audio = { src: '', error: null, load() {}, pause() {}, play() {
    return this.src === 'slow' ? new Promise<void>(() => {}) : Promise.resolve();
  } };
  assert.equal(await playTrackSources(audio, ['slow', 'good'], () => true, 5,
    error => failures.push(error)), 'good');
  let current = true;
  const request = playTrackSources(audio, ['slow', 'good'], () => current, 5, error => failures.push(error));
  current = false;
  assert.equal(await request, null);
  assert.equal(failures.length, 0);
});
