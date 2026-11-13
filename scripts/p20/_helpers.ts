import { createBubbleSim, stepBubbles, type BubbleView, type SimEnv } from '../../src/components/pond-gl-test3/decor/bubbles/sim/bubble-sim';
import { DEFAULT_BUBBLE_TUNING } from '../../src/components/pond-gl-test3/decor/bubbles/bubble-tuning';

export function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}
export const W = 1440, H = 900;
export const base = (over: Partial<SimEnv> = {}): SimEnv => ({
  w: W, h: H, discs: [], discCount: 0, surfaceD: 0.525, playing: false, reduced: false, tuning: DEFAULT_BUBBLE_TUNING, onPop: () => {}, ...over,
});

/** 跑 seconds 秒：返回每帧可见泡、同时组数的直方图与均值、出现过的组数。 */
export function run(seed: number, seconds: number, env: SimEnv, dt = 1 / 60, keepFrames = true) {
  const rng = seeded(seed), sim = createBubbleSim(rng), out: BubbleView[] = [];
  const frames: BubbleView[][] = [];
  const hist = [0, 0, 0, 0, 0, 0];
  let sumGroups = 0, steps = 0, peakGroups = 0, peakBubbles = 0, spawned = 0;
  let prev = new Set<unknown>();
  for (let t = 0; t < seconds; t += dt) {
    const n = stepBubbles(sim, dt, env, rng, out);
    const g = sim.chains.length;
    hist[Math.min(g, 5)]++; sumGroups += g; steps++; peakGroups = Math.max(peakGroups, g); peakBubbles = Math.max(peakBubbles, n);
    const now = new Set<unknown>(sim.chains);
    for (const c of now) if (!prev.has(c)) spawned++;
    prev = now;
    if (keepFrames) frames.push(out.slice(0, n).map((v) => ({ ...v })));
  }
  return { frames, hist, meanGroups: sumGroups / steps, peakGroups, peakBubbles, spawned, steps, sim };
}
