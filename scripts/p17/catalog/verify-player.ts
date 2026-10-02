import assert from 'node:assert/strict';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import { originalAudioSources, releaseOriginalPlayback, toPlayerTrack } from '../../../src/lib/music-catalog/player-adapter';
import { getTrackAudioSources } from '../../../src/components/player/track-audio';

// 核对生产播放器消费真实目录的来源，不访问网络、钱包或数据库。
for (const track of getMusicCatalog().tracks) {
  const sources = originalAudioSources(track.trackId);
  for (let index = 0; index < sources.length; index++) {
    const playable = toPlayerTrack(track.trackId, index);
    assert.equal(playable.id, track.trackId);
    assert.equal(playable.arweave_url, track.audioArUri);
    assert.equal(playable.week, track.displayNumber);
    assert.deepEqual(getTrackAudioSources(playable), [...sources.slice(index), ...sources.slice(0, index)]);
  }
}
assert.throws(() => toPlayerTrack('不存在的曲目'));
const [first, second] = getMusicCatalog().tracks;
let stopped = 0;
let audio: { src: string } | null = { src: originalAudioSources(first.trackId)[1] };
const host = { getAudioElement: () => audio, stop: () => { stopped++; } };
releaseOriginalPlayback(first.trackId, host);
assert.equal(stopped, 1, '离页应停止本曲试听，包括回退网关');
audio = { src: originalAudioSources(second.trackId)[0] };
releaseOriginalPlayback(first.trackId, host);
assert.equal(stopped, 1, '离页不能停止已经切换的另一首曲目');
audio = null;
releaseOriginalPlayback(first.trackId, host);
assert.equal(stopped, 1, '没有音频时无需停止');
console.log('35首永久身份、主线播放器来源、有界网关轮转及离页播放归属清理，通过');
