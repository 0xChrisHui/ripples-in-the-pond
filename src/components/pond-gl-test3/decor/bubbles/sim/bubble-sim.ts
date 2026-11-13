/**
 * P20 池塘气泡调度（纯逻辑，不碰 three / React）。所有数值来自调参表（bubble-tuning）。
 *
 * 多组并发：同时活跃的组数服从截断离散钟形分布（均值 meanGroups、上限 maxGroups、标准差 spread，见 bubble-schedule）。
 * 目标组数每隔 4–9 秒沿相邻档走一步（Metropolis，平稳分布严格等于上面的钟形分布，不会从 0 突然跳到 4）：
 * 不够就补一组（起点错开），多了就把最老的一组"收尾"（现有泡升完即止）。
 * 一组 = 同一个水面落点上依次升起的若干泡；随机只在生成一组时取值，运动中不再取随机数。
 * 控制台"立即"请求：新增一组，不打断现有的；立即出手记会替换正在显示的手记。
 */
import { DEFAULT_BUBBLE_TUNING, type BubbleTuning } from '../bubble-tuning';
import { groupDistribution, stepGroups } from './bubble-schedule';
import { hasActiveCarrier, retireChain, spawnChain, stepOne } from './bubble-chain';
import { between, type BubbleView, type BurstKind, type BurstResult, type Chain, type Rng, type SimEnv } from './bubble-core';

export type { BubbleView, BurstKind, BurstResult, SimEnv } from './bubble-core';

export interface BubbleSim {
  time: number;
  retargetAt: number; target: number; spawnAt: number;
  chains: Chain[]; untilNote: number;
  forced: BurstKind | null; result: BurstResult;
  keepFull: boolean;
}

const FIRST_DELAY: [number, number] = [3, 8];   // 开场等多久才出第一组
const RETARGET: [number, number] = [4, 9];      // 目标组数多久走一步（相邻档之间）
const STAGGER: [number, number] = [1, 3];       // 补组之间至少错开多久
const RETRY = 1;                                // 找不到位置后多久再试
const noteEvery = (r: Rng, t: BubbleTuning) => Math.max(1, Math.round(between(r, t.noteEveryMin, t.noteEveryMax)));

export function createBubbleSim(rng: Rng): BubbleSim {
  return {
    time: 0, retargetAt: 0, target: 0, spawnAt: between(rng, FIRST_DELAY[0], FIRST_DELAY[1]),
    chains: [], untilNote: noteEvery(rng, DEFAULT_BUBBLE_TUNING), forced: null, result: null, keepFull: false,
  };
}

function retarget(sim: BubbleSim, env: SimEnv, rng: Rng): void {
  const t = env.tuning;
  const maxG = Math.max(1, Math.round(t.maxGroups));
  const mean = Math.min(t.meanGroups * (env.playing ? t.playingGroupsMult : 1), maxG);
  const keepFull = t.keepFull === 1;
  // 保持满组数：直接定到上限；否则沿相邻档走一步（先把目标夹进 0..maxG，参数变小时不会悬在范围外）
  sim.target = keepFull ? maxG : stepGroups(groupDistribution(mean, t.spread, maxG), Math.min(sim.target, maxG), rng(), rng());
  sim.keepFull = keepFull;
  sim.retargetAt = sim.time + between(rng, RETARGET[0], RETARGET[1]);
}

/** 控制台"立即冒一串 / 出手记"：新增一组；已满或找不到位置时报"没有空位"。 */
function handleBurst(sim: BubbleSim, env: SimEnv, rng: Rng, kind: BurstKind): void {
  const maxG = Math.max(1, Math.round(env.tuning.maxGroups));
  if (sim.chains.length >= maxG) { sim.result = 'failed'; return; }
  const note = kind === 'note' && !!env.carrier;
  if (note) env.carrier?.clear(); // 立即出手记：替换正在显示的手记
  const chain = spawnChain(rng, env, sim.chains, note ? 'first' : null, true);
  if (chain) sim.chains.push(chain);
  sim.result = chain ? 'started' : 'failed';
}

/** 推进 dt 秒，把当前可见的泡写进 out（复用数组），返回个数。 */
export function stepBubbles(sim: BubbleSim, dt: number, env: SimEnv, rng: Rng, out: BubbleView[]): number {
  const t = env.tuning;
  sim.time += dt;
  sim.result = null;
  if (env.burst) sim.forced = env.burst;
  if (env.reduced) {
    if (sim.chains.length) env.carrier?.clear();
    sim.chains.length = 0; sim.forced = null;
    return 0;
  }
  if (sim.time >= sim.retargetAt || (t.keepFull === 1) !== sim.keepFull) retarget(sim, env, rng);

  const kind = sim.forced;
  sim.forced = null;
  if (kind) handleBurst(sim, env, rng, kind);

  const scheduled = sim.chains.filter((c) => !c.fromBurst && !c.retired);
  const maxG = Math.max(1, Math.round(t.maxGroups));
  if (scheduled.length < sim.target && sim.chains.length < maxG && sim.time >= sim.spawnAt) {
    const wantNote = sim.untilNote <= 1 && !env.playing && !!env.carrier && !hasActiveCarrier(sim.chains);
    const chain = spawnChain(rng, env, sim.chains, wantNote ? 'last' : null, false);
    sim.spawnAt = sim.time + (chain ? between(rng, STAGGER[0], STAGGER[1]) : RETRY);
    if (chain) {
      sim.chains.push(chain);
      sim.untilNote = wantNote ? noteEvery(rng, t) : Math.max(1, sim.untilNote - 1);
    }
  }
  // 超过目标：把最老的几组收尾（带着正显示手记的那一组不动）
  let excess = scheduled.length - sim.target;
  if (excess > 0) {
    for (const c of [...scheduled].sort((a, b) => b.t - a.t)) {
      if (excess <= 0) break;
      if (hasActiveCarrier([c])) continue;
      retireChain(c); excess--;
    }
  }

  let count = 0;
  for (let i = sim.chains.length - 1; i >= 0; i--) {
    const chain = sim.chains[i];
    chain.t += dt;
    if (chain.t >= chain.end) { sim.chains.splice(i, 1); continue; }
    for (const b of chain.bubbles) {
      const view = out[count] ?? (out[count] = { x: 0, y: 0, radius: 0, alpha: 0, depth: 0 });
      if (stepOne(chain, b, dt, env, view)) count++;
    }
  }
  return count;
}

/**
 * 空闲帧快路径：没有任何泡、没有立即请求、没到换目标 / 补组时刻 → 本帧只推进时间并返回 true，
 * 调用方可跳过收集球、上传缓冲、解析颜色。结果与完整 stepBubbles 逐帧一致（这些帧里本来就不取随机数、不产生泡）。
 */
export function advanceIfIdle(sim: BubbleSim, dt: number, keepFull: boolean, burst: BurstKind | null): boolean {
  if (burst || sim.forced || sim.chains.length > 0 || keepFull !== sim.keepFull) return false;
  const due = sim.target > 0 ? Math.min(sim.retargetAt, sim.spawnAt) : sim.retargetAt;
  if (sim.time + dt >= due) return false;
  sim.time += dt;
  sim.result = null;
  return true;
}

/** 当前是否有由控制台"立即"触发的组在升（按钮状态用）。 */
export function chainFromBurst(sim: BubbleSim): boolean {
  return sim.chains.some((c) => c.fromBurst);
}
