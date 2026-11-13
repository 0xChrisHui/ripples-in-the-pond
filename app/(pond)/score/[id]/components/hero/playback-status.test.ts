import assert from 'node:assert/strict';
import { playbackStatusKey } from './playback-status';

assert.equal(playbackStatusKey('ready', false), 'hintIdle');
assert.equal(playbackStatusKey('loading', false), 'hintPreparing');
assert.equal(playbackStatusKey('loading', true), 'hintQueued');
assert.equal(playbackStatusKey('paused', false), 'hintPaused');
assert.equal(playbackStatusKey('ended', false), 'hintEnded');
assert.equal(playbackStatusKey('error', false), 'hintError');
assert.equal(playbackStatusKey('playing', false), null);
console.log('播放状态文案：7 种状态通过');
