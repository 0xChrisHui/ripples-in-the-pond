/**
 * P20 气泡多组并发调度（纯函数，无 DOM / three）。
 *
 * 需求（用户）：每时每刻同时有 1.5 组气泡冒泡（均值），最多同时 4 组，类似钟形分布。
 * 专业描述：同时活跃的气泡组数是随时间变化的随机量，服从截断离散钟形分布（近似正态），
 * 均值 meanGroups、取值 0..maxGroups、标准差 spread。
 * 做法：对 0..maxGroups 每档按正态密度加权后归一，再用二分搜索微调中心，使离散分布的均值恰为 meanGroups。
 */
export interface Dist { weights: number[]; mean: number }

const normal = (x: number, mu: number, sigma: number) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));

function weightsFor(mu: number, sigma: number, maxGroups: number): number[] {
  const raw = Array.from({ length: maxGroups + 1 }, (_, k) => normal(k, mu, sigma));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}
const meanOf = (w: number[]) => w.reduce((acc, p, k) => acc + p * k, 0);

/** 构造分布：截断会把均值拉偏，所以搜索中心 mu，使离散均值 = meanGroups。 */
export function groupDistribution(meanGroups: number, spread: number, maxGroups: number): Dist {
  const target = Math.min(Math.max(meanGroups, 0), maxGroups);
  const sigma = Math.max(0.05, spread);
  let lo = -2, hi = maxGroups + 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (meanOf(weightsFor(mid, sigma, maxGroups)) < target) lo = mid; else hi = mid;
  }
  const weights = weightsFor((lo + hi) / 2, sigma, maxGroups);
  return { weights, mean: meanOf(weights) };
}

/** 按分布抽一个目标组数（r ∈ [0,1)）。 */
export function sampleGroups(dist: Dist, r: number): number {
  let acc = 0;
  for (let k = 0; k < dist.weights.length; k++) {
    acc += dist.weights[k];
    if (r < acc) return k;
  }
  return dist.weights.length - 1;
}

export interface Candidate { x: number; y: number }
export interface Obstacle { x: number; y: number; r: number }

/**
 * 候选落点打分：离球越远、离其他活跃组落点越远越好。
 * 返回"到最近障碍的距离（球取边缘距离，组落点取中心距离）"，调用方取最大者。
 */
export function scoreCandidate(c: Candidate, discs: ReadonlyArray<Obstacle>, discCount: number, others: ReadonlyArray<Candidate>): number {
  let best = Infinity;
  for (let k = 0; k < discCount; k++) best = Math.min(best, Math.hypot(c.x - discs[k].x, c.y - discs[k].y) - discs[k].r);
  for (const o of others) best = Math.min(best, Math.hypot(c.x - o.x, c.y - o.y));
  return best;
}

/**
 * 相邻档转移（Metropolis）：当前 n 组，等概率提议 n±1，按 min(1, π(n')/π(n)) 接受。
 * 平稳分布严格等于 π，且只在相邻档之间走（不会突然从 0 跳到 4）。
 * 返回新的档位；越界的提议视为不动。r1 选方向，r2 决定是否接受（都 ∈ [0,1)）。
 */
export function stepGroups(dist: Dist, n: number, r1: number, r2: number): number {
  const next = r1 < 0.5 ? n - 1 : n + 1;
  if (next < 0 || next >= dist.weights.length) return n;
  const ratio = dist.weights[next] / Math.max(dist.weights[n], 1e-12);
  return r2 < Math.min(1, ratio) ? next : n;
}
