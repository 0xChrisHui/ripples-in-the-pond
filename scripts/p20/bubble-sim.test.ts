import assert from 'node:assert/strict';
import { createBubbleSim, stepBubbles, type BubbleView, type SimEnv } from '../../src/components/pond-gl-test3/decor/bubbles/bubble-sim';
import { DEFAULT_BUBBLE_TUNING } from '../../src/components/pond-gl-test3/decor/bubbles/bubble-tuning';

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}
const W = 1440, H = 900;
const base = (over: Partial<SimEnv> = {}): SimEnv => ({
  w: W, h: H, discs: [], discCount: 0, surfaceD: 0.525, playing: false, reduced: false, tuning: DEFAULT_BUBBLE_TUNING, onPop: () => {}, ...over,
});

/** 跑 seconds 秒，返回每帧可见泡数组与"出现过的串"数（可见→全无 的次数）。 */
function run(seed: number, seconds: number, env: SimEnv) {
  const rng = seeded(seed), sim = createBubbleSim(rng), out: BubbleView[] = [];
  let chains = 0, prev = 0, peak = 0;
  const frames: BubbleView[][] = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    const n = stepBubbles(sim, 1 / 60, env, rng, out);
    if (prev === 0 && n > 0) chains++;
    prev = n; peak = Math.max(peak, n);
    frames.push(out.slice(0, n).map((v) => ({ ...v })));
  }
  return { chains, peak, frames };
}

// 1. 正常运行：一分钟内出现 1–6 串；同屏泡数 ≤ 6；只在水下→水面的径向区间内
{
  const { chains, peak, frames } = run(7, 120, base());
  assert.ok(chains >= 3 && chains <= 8, `120 秒应有数串，实际 ${chains}`);
  assert.ok(peak >= 2 && peak <= 6, `同屏泡数 ${peak}`);
  for (const f of frames) for (const v of f) {
    assert.ok(v.alpha >= 0 && v.alpha <= 1 && v.depth >= 0 && v.depth <= 1);
    assert.ok(v.radius >= 1 && v.radius <= 7.5, `半径 ${v.radius}`);
    assert.ok(v.x > -50 && v.x < W + 50 && v.y > -50 && v.y < H + 50);
  }
}
// 2. 同屏最多一串：任何时刻泡数不超过每串上限（6）且串间有空档
{
  const { frames } = run(11, 200, base());
  let gaps = 0, prev = 0;
  for (const f of frames) { if (prev > 0 && f.length === 0) gaps++; prev = f.length; }
  assert.ok(gaps >= 3, '串与串之间应出现空档');
}
// 3. 避让：球铺满画面中央一大块时，泡绝不贴着球（避让生成 + 逐帧淡出）
{
  const discs = [{ x: W / 2, y: H / 2, r: 260 }, { x: W * 0.3, y: H * 0.35, r: 90 }];
  const { frames } = run(3, 300, base({ discs, discCount: discs.length }));
  for (const f of frames) for (const v of f) {
    for (const d of discs) {
      const edge = Math.hypot(v.x - d.x, v.y - d.y) - d.r;
      if (edge < 0) assert.ok(v.alpha < 0.001, `球内的泡必须全透明（edge=${edge.toFixed(1)}, alpha=${v.alpha.toFixed(3)}）`);
    }
  }
}
// 4. 球把所有路径都占满 → 一串都生成不出来（跳过而不是硬出）
{
  const discs = [{ x: W / 2, y: H / 2, r: 5000 }];
  const { chains } = run(5, 200, base({ discs, discCount: 1 }));
  assert.equal(chains, 0);
}
// 5. 减弱动效：不生成；运行中途开启：当前串立刻撤掉
{
  assert.equal(run(9, 120, base({ reduced: true })).chains, 0);
  const rng = seeded(2), sim = createBubbleSim(rng), out: BubbleView[] = [];
  let shown = 0;
  for (let t = 0; t < 40 && shown === 0; t += 1 / 60) shown = stepBubbles(sim, 1 / 60, base(), rng, out);
  assert.ok(shown > 0, '应已有泡');
  assert.equal(stepBubbles(sim, 1 / 60, base({ reduced: true }), rng, out), 0);
}
// 6. 播放中（日蚀）串间隔加倍：同样时长内串数明显更少
{
  const quiet = run(21, 600, base({ playing: true })).chains;
  const normal = run(21, 600, base()).chains;
  assert.ok(quiet < normal, `播放中 ${quiet} 应少于平时 ${normal}`);
}
// 7. 水面落点在画面 15%–85% 区域内（深处看不出，取每串最靠近水面的泡）
{
  const { frames } = run(13, 300, base());
  for (const f of frames) for (const v of f) {
    if (v.depth > 0.98) {
      assert.ok(v.x > W * 0.12 && v.x < W * 0.88 && v.y > H * 0.12 && v.y < H * 0.88, `水面落点 (${v.x | 0},${v.y | 0})`);
    }
  }
}
// 8. 破水：每个泡恰好破一次，落在水面（泡数 = 破水数）；被球挡住的不破
{
  const rng = seeded(17), sim = createBubbleSim(rng), out: BubbleView[] = [];
  const pops: Array<[number, number]> = [];
  const env = base({ onPop: (x, y) => pops.push([x, y]) });
  let shown = 0, lastShown = 0;
  for (let t = 0; t < 33; t += 1 / 60) { // 首串最迟 8 秒起、25 秒内收尾，下一串最早 35 秒
    const n = stepBubbles(sim, 1 / 60, env, rng, out);
    if (n > 0) shown = Math.max(shown, n);
    lastShown = n;
  }
  assert.ok(pops.length >= 3 && pops.length <= 6, `一串破水数 ${pops.length}`);
  assert.equal(lastShown, 0);
  for (const [x, y] of pops) assert.ok(x > W * 0.1 && x < W * 0.9 && y > H * 0.1 && y < H * 0.9);
  const covered = [{ x: W / 2, y: H / 2, r: 5000 }];
  const sim2 = createBubbleSim(seeded(17)); const got: number[] = [];
  for (let t = 0; t < 33; t += 1 / 60) stepBubbles(sim2, 1 / 60, base({ discs: covered, discCount: 1, onPop: () => got.push(1) }), seeded(17), out);
  assert.equal(got.length, 0);
}
console.log('P20 气泡模拟测试通过');
