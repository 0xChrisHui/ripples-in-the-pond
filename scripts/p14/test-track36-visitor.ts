import assert from 'node:assert/strict';
import type { Track } from '../../src/types/tracks';
import { sampleTrack36Path } from '../../src/components/pond-gl-test3/visitor/track36-path';
import {
  advanceTrack36Visitor,
  createTrack36State,
  getPondRenderNodes,
  positionTrack36InSim,
  setTrack36InteractionSlow,
  TRACK36_TRAVEL_MS,
} from '../../src/components/pond-gl-test3/visitor/track36-state';
import {
  advanceScenePresence, getScenePresence, resetScenePresence,
} from '../../src/components/pond-gl-test3/focus/playback-focus';
import { project, type ProjCtx } from '../../src/components/pond-gl-test3/sphere-projection';

const track = {
  id: 'track-36', title: '36', week: 36, audio_url: 'https://example.invalid/36.mp3',
  cover: '#d9e6df', island: 'A', created_at: '2026-09-12T00:00:00Z', published: true,
  arweave_url: null, audio_gateway_urls: [], material_mintable: false,
} as Track;

function advance(state: ReturnType<typeof createTrack36State>, now: number, patch = {}) {
  advanceTrack36Visitor(state, {
    now, width: 1000, height: 800, anyPlaying: false, featuredPlaying: false,
    hidden: false, reducedMotion: false, nextDelayMs: 30_000, waterLevel: 0.53, ...patch,
  });
}

assert.deepEqual(sampleTrack36Path(0), { x: -0.12, y: 0.1, depthOffset: -0.3 });
assert.equal(sampleTrack36Path(0.48).depthOffset, 0.2);
assert.ok(Math.abs(sampleTrack36Path(0.74).depthOffset + 0.1) < 1e-9);
assert.equal(sampleTrack36Path(1).y, 1.12);

const visitor = createTrack36State(track, 2_000);
for (let now = 0; now <= 2_250; now += 250) advance(visitor, now);
assert.equal(visitor.active, true, '2 秒后必须首次出现');
assert.equal(getPondRenderNodes(Array(35).fill(visitor.node), visitor).length, 36);

const beforeFreeze = visitor.progress;
advance(visitor, 2_500, { anyPlaying: true, featuredPlaying: true });
assert.equal(visitor.progress, beforeFreeze, '播放时路径必须冻结');
setTrack36InteractionSlow(visitor, true);
advance(visitor, 2_750);
assert.ok(visitor.progress - beforeFreeze < 250 / TRACK36_TRAVEL_MS, 'hover/focus 必须显著减速');
setTrack36InteractionSlow(visitor, false);
for (let now = 2_750; now <= 2_750 + TRACK36_TRAVEL_MS + 500; now += 250) {
  advance(visitor, now);
  if (!visitor.active) break;
}
assert.equal(visitor.active, false, '15 秒路径结束后必须退场');
assert.equal(visitor.waitMs, 30_000, '退场后必须进入 24–36 秒复现等待');

const reduced = createTrack36State(track, 4_000);
advance(reduced, 100, { reducedMotion: true });
assert.equal(reduced.active, true);
assert.equal(reduced.node.displayZ, 0.53, 'reduced-motion 必须静置在实时水面');
const projection: ProjCtx = {
  cx: 500, cy: 400, mx: 0, my: 0, focusZ: 0.53,
  dof: true, perspective: true, parallax: true,
};
positionTrack36InSim(reduced, 1000, 800, projection);
const projected = project(reduced.node.x ?? 0, reduced.node.y ?? 0, reduced.node.z, projection, reduced.node);
assert.ok(Math.abs(projected.sx - 720) < 1e-9, '逆投影后必须回到同一屏幕路径');

resetScenePresence();
advanceScenePresence(0, 95, false);
assert.ok(getScenePresence() > 0 && getScenePresence() < 1, '普通模式必须缓慢淡出');
advanceScenePresence(0, 1, true);
assert.equal(getScenePresence(), 0, 'reduced-motion 必须直接进入纯黑');
resetScenePresence();

console.log('P14-G #36 路径、冻结、复现与 reduced-motion 测试通过');
