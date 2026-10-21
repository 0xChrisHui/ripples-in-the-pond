'use client';
import type { ForceCollide, Simulation } from 'd3-force';
import { computeNodeAttrs, type GroupId, type SimLink } from '@/src/components/archipelago/sphere-config';
import type { FeaturedEcho } from '@/src/types/featured-echo';
import { createGlNode, type GlPhysNode } from './nodes';
import { project, unproject, type ProjCtx } from '../../sphere-projection';
import { depthOf, getCameraFx, getPointerFx } from '../../pointer-fx';
import { getEffectiveWaterLevel } from '../../water/water-level';
import { HALO_R } from '../sphere-shader';
import {
  advanceSpecial36Transition, enterSpecial36, frameFor, getSpecial36Presence, leaveSpecial36, toScreen, SPECIAL36_HIT_MIN,
} from '../../special36/special36-step';

type EchoSim = Simulation<GlPhysNode, SimLink<GlPhysNode>>;
type SizeRef = { current: { w: number; h: number } };

/** 安全区内选最空旷的出生点，同时考虑屏幕遮挡与 sim 碰撞距离。 */
function placeEcho(node: GlPhysNode, nodes: GlPhysNode[], proj: ProjCtx): void {
  const frame = frameFor(node, proj);
  let best = { x: proj.cx, y: proj.cy }, bestGap = -Infinity;
  for (let row = 1; row <= 9; row++) {
    for (let col = 1; col <= 9; col++) {
      const screen = toScreen({ x: col / 10, y: row / 10 }, frame);
      const point = unproject(screen.x, screen.y, depthOf(node), proj, node);
      if (point.x < 20 || point.y < 20 || point.x > proj.cx * 2 - 20 || point.y > proj.cy * 2 - 20) continue;
      let gap = Infinity;
      for (const n of nodes) {
        const p = project(n.x ?? proj.cx, n.y ?? proj.cy, depthOf(n), proj, n);
        const visual = Math.hypot(screen.x - p.sx, screen.y - p.sy) - frame.r - n.radius * HALO_R * p.scale;
        const physical = Math.hypot(point.x - (n.x ?? proj.cx), point.y - (n.y ?? proj.cy))
          - (node.radius + n.radius) * 1.1 - 16;
        gap = Math.min(gap, visual, physical);
      }
      if (gap > bestGap) { best = point; bestGap = gap; }
    }
  }
  node.x = best.x; node.y = best.y; node.vx = 0; node.vy = 0;
}

/** 仅按永久身份协调；A 完整退场后再追加 B，任意时刻最多一个 Echo。 */
export function reconcileEchoNode(
  sim: EchoSim, echo: FeaturedEcho | null, groupId: GroupId, dataVersion: string,
  proj: ProjCtx, reduced = false, running = true,
): GlPhysNode[] {
  const current = sim.nodes();
  const old = current.find((n) => n.echo);
  if (old) {
    if (reduced) advanceSpecial36Transition(old, 0, true);
    if (old.echo?.identity !== echo?.identity) leaveSpecial36(old, reduced);
    if (getSpecial36Presence(old).phase !== 'removed') return current;
  }
  if (!old && !echo) return current;
  const next = old ? current.filter((n) => n !== old) : [...current];
  if (echo) {
    const node = createGlNode({ id: echo.playbackId, echo, ...computeNodeAttrs({ week: 36 }, groupId) }, 0.5, dataVersion);
    placeEcho(node, next, proj);
    enterSpecial36(node, reduced);
    next.push(node); // 只追加到末尾，普通球下标保持稳定。
  }
  // d3 初始化会将固定节点覆到 fx/fy；保留重绑前的实际位置与速度。
  const motion = next.filter((n) => !n.echo).map((n) => ({ n, x: n.x, y: n.y, vx: n.vx, vy: n.vy }));
  sim.nodes(next);
  for (const { n, x, y, vx, vy } of motion) Object.assign(n, { x, y, vx, vy });
  sim.alpha(0.02);
  if (running) sim.restart();
  else sim.stop();
  return next;
}

/** 退场节点仍可能收到键盘/指针事件，不能借当前钱包的回调误播另一枚 Echo。 */
export async function toggleCurrentEcho(sim: EchoSim | null, echo: FeaturedEcho | null, toggle: () => Promise<void>): Promise<void> {
  const node = sim?.nodes().find((n) => n.echo);
  if (!echo || !node || node.echo?.identity !== echo.identity || (node._presence ?? 1) < SPECIAL36_HIT_MIN) return;
  const phase = getSpecial36Presence(node).phase;
  if (phase === 'leaving' || phase === 'removed') return;
  await toggle();
}

/** effect 生命周期拥有帧回调；隐藏暂停、清理取消，旧回调不能发布或重新追加节点。 */
export function observeEchoNode(
  sim: EchoSim, echo: FeaturedEcho | null, groupId: GroupId, dataVersion: string,
  size: SizeRef, publish: (nodes: GlPhysNode[]) => void,
): () => void {
  let active = true, raf = 0, last = performance.now();
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sync = (publishCurrent = false) => {
    if (!active) return;
    if (document.hidden) sim.stop(); // 首次建 sim 也可能恰好发生在后台。
    const { w, h } = size.current;
    const proj = { cx: w / 2, cy: h / 2, ...getPointerFx(), ...getCameraFx(), focusZ: getEffectiveWaterLevel() };
    const before = sim.nodes();
    const next = reconcileEchoNode(sim, echo, groupId, dataVersion, proj, media.matches, !document.hidden);
    // d3 缓存半径；过渡帧与偏好切换时刷新，稳定期没有 rAF 循环。
    const collide = sim.force('collide') as ForceCollide<GlPhysNode> | undefined;
    if (next.some((n) => n.echo)) collide?.radius(collide.radius());
    if (publishCurrent || next !== before) queueMicrotask(() => { if (active) publish(sim.nodes()); });
  };
  const schedule = () => {
    const node = sim.nodes().find((n) => n.echo);
    const phase = node && getSpecial36Presence(node).phase;
    if (active && !document.hidden && !raf && (phase === 'arriving' || phase === 'leaving')) {
      raf = requestAnimationFrame(tick);
    }
  };
  const tick = (now: number) => {
    raf = 0;
    if (!active || document.hidden) return;
    const node = sim.nodes().find((n) => n.echo);
    if (node) advanceSpecial36Transition(node, Math.max(0, (now - last) / 1000), media.matches);
    last = now;
    sync();
    schedule();
  };
  const resume = () => {
    cancelAnimationFrame(raf); raf = 0; last = performance.now();
    sync();
    schedule();
  };
  sync(true); // 接管上一个 effect 清理时取消的发布；相同数组由 React 自行跳过更新。
  schedule();
  document.addEventListener('visibilitychange', resume);
  media.addEventListener('change', resume);
  return () => {
    active = false;
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', resume);
    media.removeEventListener('change', resume);
  };
}
