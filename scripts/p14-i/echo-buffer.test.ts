import assert from 'node:assert/strict';
import { preserveInstanceSmoothing } from '@/src/components/pond-gl-test3/spheres/SphereInstances';
import type { InstanceBuf } from '@/src/components/pond-gl-test3/spheres/sphere-frame';
import { buildGlNodes, createGlNode } from '@/src/components/pond-gl-test3/spheres/simulation/nodes';
import { computeNodeAttrs } from '@/src/components/archipelago/sphere-config';
import { tracks, echo, otherEcho } from './echo-fixtures';

const createBuffer = (count: number): InstanceBuf => ({
  aColor: new Float32Array(count * 3), aParams: new Float32Array(count * 4),
  aSeed: new Float32Array(count * 2), aSubmerge: new Float32Array(count),
  aLifeDim: new Float32Array(count).fill(1), baseColors: Array.from({ length: count }, () => [1, 1, 1] as const),
  hoverLerp: new Float32Array(count), dimLerp: new Float32Array(count).fill(1),
});
const nodes = buildGlNodes(tracks, 'A').nodes;
const old = createBuffer(35);
nodes.forEach((_, i) => { old.hoverLerp[i] = i / 35; old.dimLerp[i] = i === 5 ? 1 : 0.02; });
const createEcho = (asset: typeof echo) => createGlNode({
  id: asset.playbackId, echo: asset, ...computeNodeAttrs({ week: 36 }, 'A'),
}, 0.5, 'legacy');
const appended = [...nodes, createEcho(echo)];
const next = createBuffer(36);
preserveInstanceSmoothing(appended, next, { nodes, buf: old });
assert.deepEqual(next.hoverLerp.slice(0, 35), old.hoverLerp, '追加不得重置旧球悬停大小');
assert.deepEqual(next.dimLerp.slice(0, 35), old.dimLerp, '普通曲播放中追加不得让其余球闪亮');
assert.equal(next.dimLerp[35], 1, '新节点独立初始化');

const removed = createBuffer(35);
preserveInstanceSmoothing(nodes, removed, { nodes: appended, buf: next });
assert.deepEqual(removed.dimLerp, old.dimLerp, '移除也保留亮度平滑');
assert.deepEqual(removed.hoverLerp, old.hoverLerp);
const changedIdentity = [...nodes, createEcho(otherEcho)];
next.hoverLerp[35] = 0.8; next.dimLerp[35] = 0.2;
const replacement = createBuffer(36);
preserveInstanceSmoothing(changedIdentity, replacement, { nodes: appended, buf: next });
assert.equal(replacement.hoverLerp[35], 0, 'B 不继承 A 的悬停状态');
assert.equal(replacement.dimLerp[35], 1);
assert.deepEqual(replacement.dimLerp.slice(0, 35), old.dimLerp);

const rebuilt = buildGlNodes(tracks, 'B').nodes;
const reset = createBuffer(35);
preserveInstanceSmoothing(rebuilt, reset, { nodes, buf: old });
assert.ok(reset.dimLerp.every((value) => value === 1), '切组换节点仍保留原重置规则');
assert.ok(reset.hoverLerp.every((value) => value === 0));
console.log('I3 追加/移除保持悬停和播放平滑、换身份与切组正确初始化通过');
