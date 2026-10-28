import assert from 'node:assert/strict';
import type { ForceCollide } from 'd3-force';
import { type GlPhysNode } from '@/src/components/pond-gl-test3/spheres/gl-sim-setup';
import { observeEchoNode } from '@/src/components/pond-gl-test3/spheres/simulation/echo-node';
import { getSpecial36Presence } from '@/src/components/pond-gl-test3/special36/special36-step';
import { createEchoSimulation, echo, otherEcho, measureEchoDisplacement, mulberry32 } from './echo-fixtures';

async function main() {
  let now = 0, nextFrame = 0, publications = 0;
  const frames = new Map<number, FrameRequestCallback>();
  class Visibility extends EventTarget { hidden = false; }
  class Media extends EventTarget { matches = false; }
  const visibility = new Visibility(), media = new Media();
  const environment = {
    document: visibility,
    window: { matchMedia: () => media },
    performance: { now: () => now },
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
  };
  const saved = new Map(Object.keys(environment).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.entries(environment).forEach(([key, value]) => Object.defineProperty(globalThis, key, { configurable: true, value }));
  const sim = createEchoSimulation();
  const collide = sim.force('collide') as ForceCollide<GlPhysNode>;
  const radiusOf = collide.radius(), radii = new Map<GlPhysNode, number>();
  let radiusReads = 0;
  collide.radius((node, index, nodes) => {
    const radius = radiusOf(node, index, nodes);
    radiusReads++; radii.set(node, radius); return radius;
  });
  let publishedNodes: GlPhysNode[] | null = null;
  const size = { current: { w: 1200, h: 800 } };
  const observe = (value: typeof echo | null) => {
    const cleanup = observeEchoNode(sim, value, 'A', 'lifecycle', size, (nodes) => {
      assert.equal(nodes, sim.nodes(), '发布的必须是当前模拟节点数组');
      if (nodes !== publishedNodes) publications++; // 对齐 React 对同一数组引用的跳过规则。
      publishedNodes = nodes;
    });
    sim.stop();
    return cleanup;
  };
  const advance = async (ms: number) => {
    now += ms;
    const batch = [...frames.values()]; frames.clear();
    batch.forEach((callback) => callback(now));
    sim.stop();
    await Promise.resolve();
  };
  const hide = (hidden: boolean) => {
    visibility.hidden = hidden;
    visibility.dispatchEvent(new Event('visibilitychange'));
  };
  let cleanup = () => { sim.stop(); };
  try {
    cleanup = observe(echo);
    const first = sim.nodes()[35];
    assert.equal(first._presence, 0, '登录态先确定也必须从 0 入场');
    assert.equal(radii.get(first), 0, '透明首 tick 的碰撞缓存必须为 0');
    sim.nodes().slice(0, 35).forEach((n) => assert.equal(radii.get(n), n.radius * 1.1 + 8));
    cleanup(); cleanup = observe({ ...echo });
    assert.equal(sim.nodes()[35], first, '发布前重跑 effect 也不能重复追加');
    await Promise.resolve();
    assert.equal(publications, 1, '新 observer 必须接管前一次尚未发布的数组');
    await advance(500);
    assert.equal(radii.get(first), (first.radius * 1.1 + 8) * first._presence!, '入场每帧必须刷新 d3 半径缓存');
    const atHide = first._presence;
    hide(true);
    assert.equal(frames.size, 0, '隐藏必须取消帧回调');
    await advance(10000);
    assert.equal(first._presence, atHide);
    hide(false);
    await advance(1000);
    assert.equal(first._presence, 1, '隐藏的时间不计入 1.5 秒入场');
    assert.equal(frames.size, 0, '稳定可见时不保留生命周期帧循环');
    assert.equal(radii.get(first), first.radius * 1.1 + 8, '入场结束必须恢复原半径');
    const stableReads = radiusReads;
    await advance(500);
    assert.equal(radiusReads, stableReads, '非过渡期不能逐帧刷新半径');

    cleanup(); cleanup = observe(null);
    await advance(600);
    assert.equal(radii.get(first), (first.radius * 1.1 + 8) * first._presence!, '退场必须同步缩小碰撞缓存');
    const leaving = first._presence;
    hide(true);
    cleanup(); cleanup = observe(otherEcho);
    await advance(10000);
    assert.equal(sim.nodes()[35], first, '后台不能提前加入 B');
    assert.equal(first._presence, leaving);
    hide(false);
    await advance(750);
    const second = sim.nodes()[35];
    assert.equal(second.echo?.identity, otherEcho.identity);
    assert.equal(second._presence, 0);
    assert.equal(publications, 2, '替换后只发布一个最新的 35+1 数组');
    await advance(300);
    const elapsed = getSpecial36Presence(second).elapsed;
    cleanup(); cleanup = observe({ ...otherEcho });
    assert.equal(sim.nodes()[35], second);
    assert.equal(getSpecial36Presence(second).elapsed, elapsed);

    // 重建/卸载时，即使手动递交已取消的旧回调，也不得复活旧节点或发布。
    cleanup(); cleanup = observe(null);
    const stale = [...frames.values()][0];
    cleanup();
    const replacement = createEchoSimulation();
    let rebuiltPublications = 0;
    const cleanupReplacement = observeEchoNode(replacement, echo, 'A', 'lifecycle', size, () => rebuiltPublications++);
    replacement.stop();
    try {
      assert.equal(replacement.nodes().length, 36);
      assert.equal(replacement.nodes()[35]._presence, 0, '重建后同样走渐显');
      const count = publications;
      stale(now + 2000);
      await Promise.resolve();
      assert.equal(publications, count);
      assert.equal(rebuiltPublications, 1);
      assert.equal(replacement.nodes()[35].echo?.identity, echo.identity);
    } finally { cleanupReplacement(); replacement.stop(); }

    cleanup = observe(null);
    media.matches = true;
    media.dispatchEvent(new Event('change'));
    assert.equal(sim.nodes().length, 35, '退场中开启减少动态效果立即移除');
    assert.equal(frames.size, 0);
    cleanup(); cleanup = observe(echo);
    assert.equal(sim.nodes()[35]._presence, 1);
    await Promise.resolve();
    const beforeCleanup = publications;
    cleanup(); cleanup = observe(null);
    assert.equal(sim.nodes().length, 35);
    cleanup();
    await Promise.resolve();
    assert.equal(publications, beforeCleanup, '卸载后取消尚未发布的微任务');
    visibility.dispatchEvent(new Event('visibilitychange'));
    media.dispatchEvent(new Event('change'));
    assert.equal(frames.size, 0, '卸载后监听器不能再次排入帧回调');
    assert.equal(sim.nodes().length, 35);

    // 50 个固定种子覆盖三种视口与全部分组，逐种子守住原 2px 预算。
    media.matches = false;
    const results: { viewport: string; entering: number; leaving: number }[] = [];
    const random = Math.random;
    try {
      for (const [w, h] of [[320, 568], [667, 375], [1440, 900]]) {
        const maxima = [0, 0];
        for (let seed = 1; seed <= 50; seed++) {
          Math.random = mulberry32(seed);
          for (const group of ['A', 'B', 'C'] as const) {
            const measured = await measureEchoDisplacement(w, h, group, advance, () => frames.size);
            for (const [phase, extra] of measured.entries()) {
              assert.ok(extra <= 2, `${w}×${h} seed=${seed} ${group} ${phase === 0 ? '入场' : '退场'}最大单 tick 额外位移 ${extra}px 超过 2px`);
              maxima[phase] = Math.max(maxima[phase], extra);
            }
          }
        }
        results.push({ viewport: `${w}×${h}`, entering: maxima[0], leaving: maxima[1] });
      }
    } finally { Math.random = random; }
    console.table(results);
    for (const { viewport, entering, leaving } of results) {
      assert.ok(entering <= 2, `${viewport} 入场最大单 tick 额外位移 ${entering}px 超过 2px`);
      assert.ok(leaving <= 2, `${viewport} 退场最大单 tick 额外位移 ${leaving}px 超过 2px`);
    }
  } finally {
    cleanup(); sim.stop();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
  console.log('I3 首次加载、隐藏恢复、快速换身份、重建、旧回调、卸载与动态偏好切换通过');
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
