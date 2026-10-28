import type { Track } from '@/src/types/tracks';
import type { FeaturedEcho } from '@/src/types/featured-echo';
import type { RecipeV1 } from '@/src/types/wallet-recipe';
import type { ProjCtx } from '@/src/components/pond-gl-test3/sphere-projection';
import assert from 'node:assert/strict';
import { computeNodeAttrs, type GroupId } from '@/src/components/archipelago/sphere-config';
import { buildGlNodes, setupGlSimulation } from '@/src/components/pond-gl-test3/spheres/gl-sim-setup';
import { createGlNode } from '@/src/components/pond-gl-test3/spheres/simulation/nodes';
import { observeEchoNode, reconcileEchoNode } from '@/src/components/pond-gl-test3/spheres/simulation/echo-node';
import { frameFor, toScreen } from '@/src/components/pond-gl-test3/special36/special36-step';
import { project, unproject } from '@/src/components/pond-gl-test3/sphere-projection';
import { depthOf } from '@/src/components/pond-gl-test3/pointer-fx';
import { HALO_R } from '@/src/components/pond-gl-test3/spheres/sphere-shader';

export const tracks: Track[] = Array.from({ length: 35 }, (_, i) => ({
  id: `track-${i + 1}`, title: `测试曲目 ${i + 1}`, week: i + 1,
  audio_url: `/tracks/${i + 1}.mp3`, arweave_url: null, audio_gateway_urls: [],
  cover: '#446655', island: 'A', created_at: '2026-01-01', published: true,
}));
export const echo: FeaturedEcho = {
  kind: 'pond-echo', chainId: 10,
  contractAddress: '0x3333333333333333333333333333333333333333', tokenId: '1',
  identity: 'eip155:10:0x3333333333333333333333333333333333333333:1',
  playbackId: 'pond-echo:eip155:10:0x3333333333333333333333333333333333333333:1',
  title: '测试 Echo', href: '/echo/1', recipe: 'A'.repeat(36) as RecipeV1,
  clips: { A: { uri: `ar://${'A'.repeat(43)}`, sha256: 'b'.repeat(64), durationMs: 7050 } },
  durationMs: 253800,
};
export const otherEcho: FeaturedEcho = {
  ...echo, tokenId: '2', identity: `${echo.identity}-B`, playbackId: `${echo.playbackId}-B`, href: '/echo/2',
};
export const projection: ProjCtx = {
  cx: 600, cy: 400, mx: 0, my: 0, focusZ: 0.5,
  dof: true, perspective: true, parallax: true,
};

/** 固定随机序列可重现审查里的偶发超预算，包括 seed=7。 */
export function mulberry32(seed: number): () => number {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createEchoSimulation(w = 1200, h = 800, group: GroupId = 'A') {
  const built = buildGlNodes(tracks, group, 'lifecycle');
  return setupGlSimulation(built.nodes, built.links, built.assignment, w, h, 'lifecycle').sim.stop();
}

/** 真正的 observer 驱动过渡；与相同 alpha 的无 Echo 模拟比较普通球逐 tick 位移向量。 */
export async function measureEchoDisplacement(
  w: number, h: number, group: GroupId, advance: (ms: number) => Promise<void>, pendingFrames: () => number,
): Promise<number[]> {
  const subject = createEchoSimulation(w, h, group), control = createEchoSimulation(w, h, group);
  const maxima = [0, 0];
  const tick = (target: typeof subject) => { target.tick(); target.on('tick')?.call(target); };
  let cleanup = () => { subject.stop(); };
  try {
    for (let i = 0; i < 600; i++) { tick(subject); tick(control); }
    for (const [phase, value] of [echo, null].entries()) {
      cleanup = observeEchoNode(subject, value, group, 'lifecycle', { current: { w, h } }, (nodes) => {
        assert.equal(nodes, subject.nodes());
      });
      subject.stop();
      // 含 presence=0 的追加首 tick、过渡完成 tick，以及移除后的下一 tick。
      for (let frame = 0; frame < (phase === 0 ? 93 : 84); frame++) {
        if (frame) await advance(1000 / 60);
        subject.stop(); control.alpha(subject.alpha());
        const before = subject.nodes().slice(0, 35).map((n, i) => ({
          x: n.x!, y: n.y!, cx: control.nodes()[i].x!, cy: control.nodes()[i].y!,
        }));
        tick(subject); tick(control);
        subject.nodes().slice(0, 35).forEach((n, i) => {
          const c = control.nodes()[i], b = before[i];
          const extra = Math.hypot((n.x! - b.x) - (c.x! - b.cx), (n.y! - b.y) - (c.y! - b.cy));
          assert.ok(Number.isFinite(extra), '位移必须是有限值');
          maxima[phase] = Math.max(maxima[phase], extra);
        });
      }
      assert.equal(pendingFrames(), 0, '过渡完成不得继续逐帧刷新碰撞');
      assert.equal(subject.nodes().length, phase === 0 ? 36 : 35);
      cleanup();
    }
  } finally { cleanup(); subject.stop(); control.stop(); }
  return maxima;
}

/** 用旧版中心点扫描作独立基准，防止拥挤时把抖动点当成回退点。 */
export function verifyCrowdedFallback(): void {
  const sim = createEchoSimulation();
  const random = Math.random;
  try {
    const nodes = sim.nodes();
    // 覆盖整个视口对角线，任何通过边界检查的点（包括抖动点）都必定碰撞。
    Object.assign(nodes[0], { x: projection.cx, y: projection.cy, radius: Math.hypot(1200, 800) });
    assert.ok(nodes[0].radius * 1.1 + 16 > Math.hypot(1200, 800));
    const node = createGlNode({ id: echo.playbackId, echo, ...computeNodeAttrs({ week: 36 }, 'A') }, 0.5, 'lifecycle');
    const frame = frameFor(node, projection);
    let best = { x: projection.cx, y: projection.cy }, bestGap = -Infinity;
    for (let row = 1; row <= 9; row++) {
      for (let col = 1; col <= 9; col++) {
        const screen = toScreen({ x: col / 10, y: row / 10 }, frame);
        const point = unproject(screen.x, screen.y, depthOf(node), projection, node);
        if (point.x < 20 || point.y < 20 || point.x > 1180 || point.y > 780) continue;
        const gap = Math.min(...nodes.flatMap((n) => {
          const p = project(n.x!, n.y!, depthOf(n), projection, n);
          return [Math.hypot(screen.x - p.sx, screen.y - p.sy) - frame.r - n.radius * HALO_R * p.scale,
            Math.hypot(point.x - n.x!, point.y - n.y!) - (node.radius + n.radius) * 1.1 - 16];
        }));
        assert.ok(gap < 0, '拥挤夹具不应存在空位');
        if (gap > bestGap) { best = point; bestGap = gap; }
      }
    }
    assert.ok(Number.isFinite(bestGap), '必须有通过边界检查的网格中心点');
    for (let seed = 1; seed <= 50; seed++) {
      Math.random = mulberry32(seed);
      for (let repeat = 0; repeat < 2; repeat++) {
        const actual = reconcileEchoNode(sim, echo, 'A', 'lifecycle', projection, false, false)[35];
        assert.deepEqual({ x: actual.x, y: actual.y }, best, `seed=${seed} 第 ${repeat + 1} 次回退必须等于旧版中心点`);
        assert.equal(reconcileEchoNode(sim, null, 'A', 'lifecycle', projection, true, false).length, 35);
      }
    }
  } finally { Math.random = random; sim.stop(); }
  console.log('I3 无空位：50 个种子重复追加均回退到旧版网格中心点');
}
