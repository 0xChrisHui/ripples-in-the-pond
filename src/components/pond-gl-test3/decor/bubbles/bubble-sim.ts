/**
 * P20 池塘气泡模拟（纯逻辑，不碰 three / React）。所有数值来自调参表（bubble-tuning）。
 *
 * 一串 = 从同一个池底点冒出的若干泡，间隔不规则；随机只在生成一串时取值，运动中不再取随机数。
 * 透视与球一致：屏幕位置 = 中心 + (出生点 − 中心) × (0.5 + d)，d 从池底升到有效水位 →
 * 泡沿径向外飘、变大。生成时避让整条路径上的球；每帧另按到球边缘的距离柔性淡出（球可被拖动 / 浮沉）。
 */
import type { Disc } from './bubble-env';
import type { BubbleTuning } from './bubble-tuning';
import { DEFAULT_BUBBLE_TUNING } from './bubble-tuning';
import type { CarrierPort } from './bubble-bridge';

export interface BubbleView {
  x: number; y: number;  // 屏幕像素
  radius: number;        // 光环半径（像素）
  alpha: number;         // 0..1，含淡入淡出与避让淡出
  depth: number;         // 0 池底 → 1 水面（外观：越深越小越软越淡）
}

interface Bubble {
  delay: number; rise: number; dwell: number; size: number; sway: number; freq: number; phase: number;
  popped: boolean;
  carrier: boolean; carrierId: number; held: number; // 载体泡：到水面后停住，等手记宿主放行再破
}
interface Chain { t: number; ox: number; oy: number; end: number; bubbles: Bubble[] }
export interface BubbleSim { time: number; nextAt: number; chain: Chain | null; untilNote: number; forced: 'plain' | 'note' | null }

export interface SimEnv {
  w: number; h: number;
  discs: ReadonlyArray<Disc>; discCount: number;
  surfaceD: number;       // 有效水位（球 z 域的 d），气泡升到这里
  playing: boolean;       // 日蚀期间：串间隔乘 playingMult
  reduced: boolean;       // 减弱动效：不生成
  tuning: BubbleTuning;
  carrier?: CarrierPort;  // 无宿主 / 不出手记时不传
  burst?: 'plain' | 'note' | null; // 控制台"立即冒一串"
  onPop: (x: number, y: number) => void; // 泡在水面停完、破掉的瞬间（屏幕像素）；球挡住时不触发
}

const FADE_FIRST: [number, number] = [3, 8];
const PATH_SAMPLES = 10;

type Rng = () => number;
const between = (r: Rng, lo: number, hi: number) => lo + (Math.max(hi, lo) - lo) * r();
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const noteEvery = (r: Rng, t: BubbleTuning) => Math.max(1, Math.round(between(r, t.noteEveryMin, t.noteEveryMax)));

export function createBubbleSim(rng: Rng): BubbleSim {
  const t = DEFAULT_BUBBLE_TUNING;
  return { time: 0, nextAt: between(rng, FADE_FIRST[0], FADE_FIRST[1]), chain: null, untilNote: noteEvery(rng, t), forced: null };
}

function scaleAt(env: SimEnv, u: number): number {
  const d0 = env.tuning.depthStart;
  return 0.5 + d0 + (env.surfaceD - d0) * u;
}

function pathClear(env: SimEnv, ox: number, oy: number): boolean {
  if (!env.tuning.avoidSpawn) return true;
  const cx = env.w / 2, cy = env.h / 2;
  for (let i = 0; i <= PATH_SAMPLES; i++) {
    const s = scaleAt(env, i / PATH_SAMPLES);
    const px = cx + (ox - cx) * s, py = cy + (oy - cy) * s;
    for (let k = 0; k < env.discCount; k++) {
      const d = env.discs[k];
      if (Math.hypot(px - d.x, py - d.y) < d.r + env.tuning.swayMargin) return false;
    }
  }
  return true;
}

function buildChain(rng: Rng, env: SimEnv, ox: number, oy: number, withNote: boolean): Chain {
  const t = env.tuning;
  const n = Math.max(1, Math.round(between(rng, t.countMin, t.countMax)));
  const bubbles: Bubble[] = [];
  let delay = 0, end = 0;
  for (let i = 0; i < n; i++) {
    const rise = between(rng, t.riseMin, t.riseMax) / Math.max(0.2, t.speed);
    const dwell = between(rng, t.dwellMin, t.dwellMax);
    bubbles.push({
      delay, rise, dwell, size: between(rng, t.sizeMin, t.sizeMax),
      sway: between(rng, t.swayMin, t.swayMax), freq: between(rng, t.swayFreqMin, t.swayFreqMax), phase: 6.2831853 * rng(),
      popped: false, carrier: withNote && i === n - 1, carrierId: 0, held: 0,
    });
    end = Math.max(end, delay + rise + dwell + 0.2); // +0.2 秒：让最后一个泡的破水在串结束前触发
    delay += between(rng, t.popGapMin, t.popGapMax);
  }
  return { t: 0, ox, oy, end, bubbles };
}

function trySpawn(rng: Rng, env: SimEnv, withNote: boolean): Chain | null {
  const t = env.tuning;
  const cx = env.w / 2, cy = env.h / 2;
  const sEnd = scaleAt(env, 1);
  for (let i = 0; i < Math.max(1, Math.round(t.maxTries)); i++) {
    const tx = env.w * between(rng, t.areaMin, t.areaMax);
    const ty = env.h * between(rng, t.areaMin, t.areaMax);
    const ox = cx + (tx - cx) / sEnd, oy = cy + (ty - cy) / sEnd; // 水面落点反推出生点
    if (pathClear(env, ox, oy)) return buildChain(rng, env, ox, oy, withNote);
  }
  return null;
}

/** 到最近球边缘的距离 → 0..1 淡出系数（贴边 0，远离 1）。 */
function discFade(env: SimEnv, x: number, y: number): number {
  if (!env.tuning.avoidFade) return 1;
  const band = env.tuning.edgeBand * Math.min(env.w, env.h);
  let f = 1;
  for (let k = 0; k < env.discCount; k++) {
    const d = env.discs[k];
    f = Math.min(f, clamp01((Math.hypot(x - d.x, y - d.y) - d.r) / band));
  }
  return f;
}

/** 推进 dt 秒，把当前可见的泡写进 out（复用数组），返回个数。 */
export function stepBubbles(sim: BubbleSim, dt: number, env: SimEnv, rng: Rng, out: BubbleView[]): number {
  const t = env.tuning;
  sim.time += dt;
  if (env.burst) sim.forced = env.burst;
  if (env.reduced) { if (sim.chain) env.carrier?.clear(); sim.chain = null; sim.forced = null; return 0; }
  if (!sim.chain && (sim.forced || sim.time >= sim.nextAt)) {
    const withNote = sim.forced ? sim.forced === 'note' && !!env.carrier : sim.untilNote <= 1 && !!env.carrier && !env.playing;
    sim.chain = trySpawn(rng, env, withNote);
    sim.nextAt = sim.chain ? Infinity : sim.time + between(rng, t.retryMin, t.retryMax);
    if (sim.chain) sim.untilNote = withNote ? noteEvery(rng, t) : Math.max(1, sim.untilNote - 1);
    sim.forced = null;
  }
  const chain = sim.chain;
  if (!chain) return 0;
  chain.t += dt;
  if (chain.t >= chain.end) {
    sim.chain = null;
    sim.nextAt = sim.time + between(rng, t.gapMin, t.gapMax) * t.intervalMult * (env.playing ? t.playingMult : 1);
    return 0;
  }
  let count = 0;
  for (const b of chain.bubbles) {
    const view = out[count] ?? (out[count] = { x: 0, y: 0, radius: 0, alpha: 0, depth: 0 });
    if (stepOne(chain, b, dt, env, view)) count++;
  }
  return count;
}

/** 推进一个泡：写 view 并返回 true = 本帧可见。载体泡到水面后停住（计入 held，并顺延串的结束时间）。 */
function stepOne(chain: Chain, b: Bubble, dt: number, env: SimEnv, view: BubbleView): boolean {
  const t = env.tuning;
  const cx = env.w / 2, cy = env.h / 2;
  let tb = chain.t - b.delay - b.held;
  if (tb < 0) return false;
  const at = (time: number) => {
    const e = Math.pow(clamp01(time / b.rise), t.riseEase);
    const s = scaleAt(env, e);
    return {
      e, y: cy + (chain.oy - cy) * s,
      x: cx + (chain.ox - cx) * s + Math.sin(Math.min(time, b.rise + b.dwell) * b.freq + b.phase) * b.sway * (0.4 + e),
    };
  };
  if (b.carrier && !b.popped && tb >= b.rise) {
    if (b.carrierId === 0) { const p = at(b.rise); b.carrierId = env.carrier?.arrive(p.x, p.y) || -1; }
    const port = env.carrier;
    if (b.carrierId > 0 && port && !port.isReleased(b.carrierId) && b.held < t.maxHold) {
      b.held += dt; chain.end += dt; tb = b.rise;       // 停在水面：时间冻结，等宿主放行
    }
  }
  const p = at(tb);
  if (tb > b.rise + b.dwell) {
    if (!b.popped) {
      b.popped = true;
      if (t.popEnabled && discFade(env, p.x, p.y) > 0.5) env.onPop(p.x, p.y);
    }
    return false;
  }
  const dwellP = dwellProgress(tb, b);
  view.x = p.x; view.y = p.y; view.depth = p.e;
  view.radius = (t.radiusDeep + t.radiusSurface * Math.pow(p.e, t.radiusCurve)) * b.size * t.size;
  view.alpha = clamp01(tb / b.rise / t.fadeIn) * (1 - dwellP * dwellP) * discFade(env, p.x, p.y);
  return true;
}

function dwellProgress(tb: number, b: Bubble): number {
  return b.dwell <= 0 ? (tb > b.rise ? 1 : 0) : clamp01((tb - b.rise) / b.dwell);
}
