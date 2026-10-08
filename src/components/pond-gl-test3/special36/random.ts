/**
 * 第36特殊圆的随机工具 + 「性格层」。
 *
 * 全部用 Math.random（每次打开页面都不同，不可复现、不可预估）。
 * 性格层 = 活跃度 mood 在慵懒/平常/活跃三档间不定时切换并缓动过渡，
 * 漂流速度、停顿概率、换层/隐现频率都乘它 → 连"随机的节奏"本身也在变。
 */

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 对数均匀：小值与大值出现机会相当（距离/时长既有极短也有极长）。 */
export function logRand(min: number, max: number): number {
  return Math.exp(rand(Math.log(min), Math.log(max)));
}

export function chance(p: number): boolean {
  return Math.random() < p;
}

export function sign(): 1 | -1 {
  return Math.random() < 0.5 ? 1 : -1;
}

/** 按权重抽取一项。 */
export function pickWeighted<T>(items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [item, w] of items) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return items[items.length - 1][0];
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 缓动曲线库：每段漂流/换层/渐变随机挑一条，速度节奏不重复。 */
export type Ease = (u: number) => number;
const EASES: readonly (readonly [Ease, number])[] = [
  [(u) => u * u * u * (u * (u * 6 - 15) + 10), 3],          // 平滑起止
  [(u) => 0.5 - 0.5 * Math.cos(Math.PI * u), 3],            // 正弦起止
  [(u) => 1 - (1 - u) ** 3, 2],                              // 先快后慢
  [(u) => u * u * u, 1.2],                                   // 先慢后快
  [(u) => u, 0.8],                                           // 匀速
  [(u) => u - Math.sin(2 * Math.PI * u) / (2 * Math.PI) * 0.85, 1.5], // 一涌一歇
];
/** 随机缓动；偶尔生成一条拐点位置/陡度都随机的非对称曲线。 */
export function pickEase(): Ease {
  if (chance(0.2)) {
    const a = rand(0.15, 0.85), p = rand(1.5, 3.5);
    return (u) => (u < a ? a * (u / a) ** p : 1 - (1 - a) * ((1 - u) / (1 - a)) ** p);
  }
  return pickWeighted(EASES);
}

/** 性格层：mood≈0.5 慵懒 / 1 平常 / 1.6 活跃。 */
interface MoodState { value: number; target: number; nextAt: number }
const mood: MoodState = { value: 1, target: 1, nextAt: 0 };
const MOOD_BANDS: readonly (readonly [readonly [number, number], number])[] = [
  [[0.35, 0.65], 3], [[0.8, 1.25], 4], [[1.35, 1.9], 3],
];

function pickMoodTarget(): number {
  const [lo, hi] = pickWeighted(MOOD_BANDS);
  return rand(lo, hi);
}

/** 每帧推进；返回当前活跃度。dt 秒。 */
export function stepMood(nowSec: number, dt: number): number {
  if (nowSec >= mood.nextAt) {
    mood.target = pickMoodTarget();
    mood.nextAt = nowSec + logRand(10, 70);
  }
  mood.value += (mood.target - mood.value) * (1 - Math.exp(-dt / 5));
  return mood.value;
}
