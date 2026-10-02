import assert from 'node:assert/strict';
import { requestPlaybackFocus, subscribePlaybackFocus } from '../../src/components/player/playback-focus';
import { ownedScoreHref } from '../../src/hooks/me/archive/score-route';
import type { OwnedScoreNFT } from '../../src/types/jam';

const track = {}, echo = {}, score = {};
const stops: string[] = [];
const releases = [
  subscribePlaybackFocus(track, () => stops.push('track')),
  subscribePlaybackFocus(echo, () => stops.push('echo')),
  subscribePlaybackFocus(score, () => stops.push('score')),
];
requestPlaybackFocus(score);
assert.deepEqual(stops.splice(0), ['track', 'echo'], 'Score 发起播放前让 Track/ECHO 同步退让');
requestPlaybackFocus(echo);
assert.deepEqual(stops.splice(0), ['track', 'score'], 'ECHO 恢复时取消 Score 播放意图');
requestPlaybackFocus(track);
assert.deepEqual(stops.splice(0), ['echo', 'score']);
releases.forEach((release) => release());
requestPlaybackFocus(score);
assert.deepEqual(stops, [], '卸载后不残留订阅');

const item: OwnedScoreNFT = { id: '1', queueId: 'test', tokenId: 1, status: 'success',
  trackTitle: '测试', eventCount: 1, failureKind: null, submittedAt: '2026-10-02' };
assert.equal(ownedScoreHref(item), '/score/1');
assert.equal(ownedScoreHref({ ...item, mintMode: 'eth_self_paid', chainId: 1,
  contractAddress: '0xABCD' }), '/score/1/0xabcd/1');
assert.equal(ownedScoreHref({ ...item, mintMode: 'eth_self_paid', chainId: 11155111,
  contractAddress: '0xABCD' }), '/score/11155111/0xabcd/1');
console.log('P11 播放互斥订阅、卸载和多链预取目标测试通过');
