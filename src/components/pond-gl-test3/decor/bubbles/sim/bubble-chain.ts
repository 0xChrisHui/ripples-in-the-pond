/**
 * P20 一组气泡的生成与推进（纯逻辑）。
 * 生成：多个候选落点里挑"离球和其他组最远"的（路径被球挡住的候选直接排除）；
 * 推进：单个泡的位置 / 淡入淡出 / 载体泡停留 / 破水。
 */
import { clamp01, discFade, pathClear, pathPoint } from './bubble-geometry';
import { scoreCandidate } from './bubble-schedule';
import { between, type Bubble, type BubbleView, type Chain, type Rng, type SimEnv } from './bubble-core';

/** 两组落点至少相隔短边的这个比例，免得挤在一处。 */
const MIN_GROUP_GAP = 0.15;
/** 立即请求用户在等，候选更多。 */
const BURST_CANDIDATES = 40;

/** carrierAt：载体泡的位置（'first' 立即出手记 / 'last' 自然出手记 / null 无手记）。 */
function buildChain(rng: Rng, env: SimEnv, ax: number, ay: number, carrierAt: 'first' | 'last' | null, fromBurst: boolean): Chain {
  const t = env.tuning;
  const n = Math.max(1, Math.round(between(rng, t.countMin, t.countMax)));
  const carrierIdx = carrierAt === 'first' ? 0 : carrierAt === 'last' ? n - 1 : -1;
  const bubbles: Bubble[] = [];
  let delay = 0, end = 0;
  for (let i = 0; i < n; i++) {
    // 领头泡取最大尺寸，其余取偏小的；升速随大小变化（大泡快，小泡慢）
    const size = t.leadBig === 1 && i === 0 ? t.sizeMax : between(rng, t.sizeMin, t.leadBig === 1 ? t.sizeMax * 0.8 : t.sizeMax);
    const rise = between(rng, t.riseMin, t.riseMax) / Math.max(0.2, t.speed) / Math.pow(Math.max(0.2, size), t.sizeSpeed);
    const dwell = between(rng, t.dwellMin, t.dwellMax);
    const angle = 6.2831853 * rng(), spread = t.birthSpread * between(rng, 0.35, 1);
    bubbles.push({
      delay, rise, dwell, size, ox: Math.cos(angle) * spread, oy: Math.sin(angle) * spread,
      sway: between(rng, t.swayMin, t.swayMax), freq: between(rng, t.swayFreqMin, t.swayFreqMax), phase: 6.2831853 * rng(),
      popped: false, carrier: i === carrierIdx, carrierId: 0, held: 0,
    });
    end = Math.max(end, delay + rise + dwell + 0.2); // +0.2 秒：让最后一个泡的破水在组结束前触发
    delay += between(rng, t.popGapMin, t.popGapMax);
  }
  return { t: 0, ax, ay, end, bubbles, fromBurst, retired: false };
}

/** 生成一组：candidates 个随机落点，过滤后取得分最高者；一个也没有则返回 null。 */
export function spawnChain(rng: Rng, env: SimEnv, others: ReadonlyArray<Chain>,
  carrierAt: 'first' | 'last' | null, fromBurst: boolean): Chain | null {
  const t = env.tuning;
  const tries = fromBurst ? BURST_CANDIDATES : Math.max(1, Math.round(t.candidates));
  const minGap = MIN_GROUP_GAP * Math.min(env.w, env.h);
  const spots = others.map((c) => ({ x: c.ax, y: c.ay }));
  let best: { x: number; y: number; score: number } | null = null;
  for (let i = 0; i < tries; i++) {
    const x = env.w * between(rng, t.areaMin, t.areaMax), y = env.h * between(rng, t.areaMin, t.areaMax);
    if (!pathClear(env, x, y)) continue;
    if (spots.some((o) => Math.hypot(x - o.x, y - o.y) < minGap)) continue;
    const score = scoreCandidate({ x, y }, env.discs, env.discCount, spots);
    if (!best || score > best.score) best = { x, y, score };
  }
  return best ? buildChain(rng, env, best.x, best.y, carrierAt, fromBurst) : null;
}

/** 这一组里是否有手记载体泡正停在水面（同屏手记最多一条，靠它判断）。 */
export function hasActiveCarrier(chains: ReadonlyArray<Chain>): boolean {
  return chains.some((c) => c.bubbles.some((b) => b.carrier && !b.popped));
}

/** 收尾：不再放出还没开始的泡，现有的升完即止（组数能较快回到目标，又不会把泡掐在半路）。 */
export function retireChain(chain: Chain): void {
  chain.retired = true;
  chain.bubbles = chain.bubbles.filter((b) => chain.t >= b.delay + b.held);
  chain.end = chain.bubbles.reduce((m, b) => Math.max(m, b.delay + b.held + b.rise + b.dwell + 0.2), chain.t);
}

/** 推进一个泡：写 view 并返回 true = 本帧可见。载体泡到水面后停住（计入 held，并顺延组的结束时间）。 */
export function stepOne(chain: Chain, b: Bubble, dt: number, env: SimEnv, view: BubbleView): boolean {
  const t = env.tuning;
  let tb = chain.t - b.delay - b.held;
  if (tb < 0) return false;
  const at = (time: number) => {
    const e = Math.pow(clamp01(time / b.rise), t.riseEase);
    const p = pathPoint(env, chain.ax, chain.ay, e);
    return { e, y: p.y + b.oy, x: p.x + b.ox + Math.sin(Math.min(time, b.rise + b.dwell) * b.freq + b.phase) * b.sway * (0.4 + e) };
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
  // 破水：停留的最后 popTime 秒里放大 popSwell 并快速淡出；之前保持不透明（否则放大看不见）
  const popT = Math.min(Math.max(t.popTime, 0.01), b.dwell);
  const pop = clamp01((tb - (b.rise + b.dwell - popT)) / popT);
  view.x = p.x; view.y = p.y; view.depth = p.e;
  view.radius = (t.radiusDeep + t.radiusSurface * Math.pow(p.e, t.radiusCurve)) * b.size * t.size * (1 + t.popSwell * pop);
  view.alpha = clamp01(tb / b.rise / t.fadeIn) * (1 - pop * pop) * discFade(env, p.x, p.y);
  return true;
}
