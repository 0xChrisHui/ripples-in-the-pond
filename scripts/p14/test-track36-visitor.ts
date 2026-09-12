import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FeaturedEcho } from '../../src/types/featured-echo';
import type { RecipeV1 } from '../../src/types/wallet-recipe';
import type { Track } from '../../src/types/tracks';
import { playTrackSources } from '../../src/components/player/track-audio';
import { buildGlNodes } from '../../src/components/pond-gl-test3/spheres/gl-sim-setup';
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

const echo = {
  kind: 'pond-echo', chainId: 10,
  contractAddress: '0x3333333333333333333333333333333333333333', tokenId: '1',
  identity: 'eip155:10:0x3333333333333333333333333333333333333333:1',
  playbackId: 'pond-echo:eip155:10:0x3333333333333333333333333333333333333333:1',
  title: 'Pond Echo · 456b—7708', href: '/echo/1',
  recipe: 'A'.repeat(36) as RecipeV1,
  clips: { A: { uri: `ar://${'A'.repeat(43)}`, sha256: 'b'.repeat(64), durationMs: 7_050 } },
  durationMs: 253_800,
} satisfies FeaturedEcho;

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

const visitor = createTrack36State(echo, 2_000);
assert.equal(visitor.node.id, echo.playbackId);
assert.equal(visitor.node.identity, echo.identity);
assert.equal(visitor.node.kind, 'featured-echo');
for (const forbidden of ['track', 'week', 'audio_url']) {
  assert.equal(forbidden in visitor.node, false, `ECHO 视觉节点不应包含 ${forbidden}`);
}
for (let now = 0; now <= 2_250; now += 250) advance(visitor, now);
assert.equal(visitor.active, true, '2 秒后必须首次出现');

const regularTracks: Track[] = Array.from({ length: 35 }, (_, index) => ({
  id: `track-${index + 1}`, title: `Track ${index + 1}`, week: index + 1,
  audio_url: `/tracks/${index + 1}.mp3`, arweave_url: null, audio_gateway_urls: [],
  cover: '#446655', island: 'A', created_at: '2026-09-12', published: true,
}));
const nodeId = (value: string | number | { id: string }): string => (
  typeof value === 'object' ? value.id : String(value)
);
for (const groupId of ['A', 'B', 'C'] as const) {
  const { nodes, links } = buildGlNodes(regularTracks, groupId);
  const regularIds = new Set(nodes.map((node) => node.id));
  assert.equal(nodes.length, 35, `${groupId} 组必须有 35 个 regular`);
  assert.equal(regularIds.size, 35, `${groupId} 组 regular id 必须唯一`);
  assert.ok(nodes.every((node) => !('kind' in node)), `${groupId} 组不得混入 featured`);
  assert.equal(getPondRenderNodes(nodes, null).length, 35, `${groupId} 组 35+0`);
  const rendered = getPondRenderNodes(nodes, visitor);
  assert.equal(rendered.length, 36, `${groupId} 组 35+1`);
  assert.equal(rendered.filter((node) => 'kind' in node && node.kind === 'featured-echo').length, 1);
  assert.ok(links.every((link) => regularIds.has(nodeId(link.source))
    && regularIds.has(nodeId(link.target))), `${groupId} links 只能引用 regular`);
}

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

const reduced = createTrack36State(echo, 4_000);
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

const hitTargetSource = readFileSync(resolve(
  process.cwd(), 'src/components/pond-gl-test3/visitor/Track36HitTarget.tsx',
), 'utf8');
assert.ok(hitTargetSource.includes("presence > 0.1 || playbackState === 'playing'"),
  '只有正在播放的 ECHO 可在日食透明阶段保留停止入口');
assert.ok(hitTargetSource.includes('document.activeElement === button) button.blur()'),
  '命中层隐藏时必须释放键盘焦点');
const echoPlaybackSource = readFileSync(resolve(
  process.cwd(), 'src/components/pond-gl-test3/visitor/useFeaturedEchoPlayback.ts',
), 'utf8');
assert.ok(echoPlaybackSource.indexOf('stopRegular();') < echoPlaybackSource.indexOf('await engine.load'),
  'ECHO 开始加载前必须停止普通 Track');
assert.ok(echoPlaybackSource.includes('onBeforePlay: () => {')
  && echoPlaybackSource.includes('includes(state)) stop();'), '普通 Track 开播前必须停止 ECHO');

async function verifyAudioOwnerRace(): Promise<void> {
  let current = true, pauseCalls = 0, finishPlay = () => {};
  const sharedAudio = {
    src: '', load: () => {}, pause: () => { pauseCalls += 1; },
    play: () => new Promise<void>((resolve) => { finishPlay = resolve; }),
  };
  const oldRequest = playTrackSources(sharedAudio, ['old.mp3'], () => current);
  current = false;
  finishPlay();
  assert.equal(await oldRequest, null, '失去 owner 的旧请求必须退出');
  assert.equal(pauseCalls, 0, '旧请求不得暂停已由新曲接管的共享 Audio');
}

void verifyAudioOwnerRace().then(() => {
  console.log('P14-G Pond Echo #1 访客路径、焦点与音频 owner 竞态测试通过');
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
