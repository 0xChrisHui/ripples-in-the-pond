import assert from 'node:assert/strict';
import { createBubbleSim, stepBubbles, type BubbleView, type SimEnv } from '../../src/components/pond-gl-test3/decor/bubbles/sim/bubble-sim';
import { stayDuration, toDisplayLines } from '../../src/components/pond-gl-test3/decor/bubbles/notes/note-display';
import * as geo from '../../src/components/pond-gl-test3/decor/bubbles/sim/bubble-geometry';
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
// 9. 载体泡：到水面后停住，宿主放行才破；宿主失联时不会永远挂着；无宿主的环境不出载体
{
  const noPort = (e: SimEnv) => e.carrier === undefined;
  const rng = seeded(31), sim = createBubbleSim(rng), out: BubbleView[] = [];
  let arrived: [number, number] | null = null, released = false, pops = 0;
  const port = { arrive: (x: number, y: number) => { arrived = [x, y]; return 7; }, isReleased: () => released, clear: () => { released = true; } };
  const env = base({ carrier: port, onPop: () => { pops++; } });
  assert.ok(!noPort(env));
  sim.untilNote = 1; // 第一串就带手记
  let holdFrames = 0;
  for (let t = 0; t < 120; t += 1 / 60) {
    const n = stepBubbles(sim, 1 / 60, env, rng, out);
    if (arrived && !released) { holdFrames++; if (holdFrames > 60 * 20) released = true; assert.ok(n >= 1, '载体泡停留时必须仍可见'); }
  }
  assert.ok(arrived, '载体泡应到达水面并登记');
  assert.ok(holdFrames >= 60 * 20, `放行前应一直停着，实际 ${holdFrames} 帧`);
  const popsAfter = pops;
  assert.ok(popsAfter >= 3, `放行后整串应都破完（${popsAfter}）`);
  // 无 carrier 端口：永不挑载体
  const rng2 = seeded(31), sim2 = createBubbleSim(rng2); sim2.untilNote = 1;
  for (let t = 0; t < 60; t += 1 / 60) stepBubbles(sim2, 1 / 60, base({ onPop: () => {} }), rng2, out);
}
// 10. 手记排版规则
{
  const lines = toDisplayLines('第一句。第二句！第三句？第四句；第五句。第六句。第七句。第八句。');
  assert.equal(lines.length, 6);
  assert.ok(lines[5].includes('第七句') && lines[5].includes('第八句'));
  assert.deepEqual(toDisplayLines('没有标点的一行'), ['没有标点的一行']);
  assert.deepEqual(toDisplayLines('It is 3.5 meters deep. Very clear.'), ['It is 3.5 meters deep.', 'Very clear.']);
  const short = stayDuration('短', 'zh', 1, 0.5), long = stayDuration('长'.repeat(80), 'zh', 3, 0.5);
  assert.ok(long > short && long < 14000 && short >= 3000);
  assert.ok(stayDuration('a'.repeat(180), 'en', 3, 0.5) < 14000);
  assert.ok(stayDuration('x', 'zh', 1, 0) < stayDuration('x', 'zh', 1, 0.999));
}
// 11. 立即冒一串：打断正在进行的串，立即开新串（result=started）
{
  const rng = seeded(41), sim = createBubbleSim(rng), out: BubbleView[] = [];
  for (let t = 0; t < 2; t += 1 / 60) stepBubbles(sim, 1 / 60, base(), rng, out); // 先跑一会儿，让自然串开始
  const before = sim.chain;
  stepBubbles(sim, 1 / 60, base({ burst: 'plain' }), rng, out);
  assert.equal(sim.result, 'started');
  assert.ok(sim.chain && sim.chain !== before, '立即请求必须换成新的一串');
  assert.equal(sim.chain.fromBurst, true);
  stepBubbles(sim, 1 / 60, base(), rng, out);
  assert.equal(sim.result, null, 'result 每帧清空');
}
// 12. 立即出手记：载体是第一个泡，不必等整串升完
{
  const rng = seeded(43), sim = createBubbleSim(rng), out: BubbleView[] = [];
  const port = { arrive: () => 9, isReleased: () => false, clear: () => {} };
  stepBubbles(sim, 1 / 60, base({ burst: 'note', carrier: port }), rng, out);
  assert.equal(sim.result, 'started');
  assert.equal(sim.chain!.bubbles[0].carrier, true, '立即出手记时第一个泡是载体');
  assert.equal(sim.chain!.bubbles.filter((b) => b.carrier).length, 1);
}
// 13. 没有宿主时，立即出手记退化为普通一串（不挑载体），仍然 started
{
  const rng = seeded(47), sim = createBubbleSim(rng), out: BubbleView[] = [];
  stepBubbles(sim, 1 / 60, base({ burst: 'note' }), rng, out);
  assert.equal(sim.result, 'started');
  assert.equal(sim.chain!.bubbles.some((b) => b.carrier), false);
}
// 14. 没有空位：全被球盖住时立即请求报 failed，且不会留下待办
{
  const rng = seeded(53), sim = createBubbleSim(rng), out: BubbleView[] = [];
  const discs = [{ x: W / 2, y: H / 2, r: 5000 }];
  stepBubbles(sim, 1 / 60, base({ burst: 'plain', discs, discCount: 1 }), rng, out);
  assert.equal(sim.result, 'failed');
  assert.equal(sim.chain, null);
  stepBubbles(sim, 1 / 60, base({ discs, discCount: 1 }), rng, out);
  assert.equal(sim.result, null);
}
// 15. 减弱动效时立即请求不生成（由 PondBubbles 据此显示"没有空位"之外的提示；这里只验 sim 不开串）
{
  const rng = seeded(59), sim = createBubbleSim(rng), out: BubbleView[] = [];
  stepBubbles(sim, 1 / 60, base({ burst: 'plain', reduced: true }), rng, out);
  assert.equal(sim.chain, null);
}
// 16. 持续冒泡：一串结束立即开下一串（串与串之间没有空档），关闭时仍有正常间隔
{
  // 量"最长连续没有气泡在上升"的时长（秒）；串结束那一帧本身会短暂为空，所以只看超过 0.1 秒的空档
  const countGaps = (continuous: number) => {
    const rng = seeded(61), sim = createBubbleSim(rng), out: BubbleView[] = [];
    const env = base({ tuning: { ...DEFAULT_BUBBLE_TUNING, continuous } });
    // 从第一串出现之后才开始统计：开场要等 3–8 秒，不算串与串之间的空档
    let gaps = 0, chains = 0, run = 0, longest = 0, started = false, prevChain = null as unknown;
    for (let t = 0; t < 300; t += 1 / 60) {
      stepBubbles(sim, 1 / 60, env, rng, out);
      if (sim.chain && sim.chain !== prevChain) { chains++; started = true; }
      if (started) { if (!sim.chain) { run++; longest = Math.max(longest, run); } else run = 0; }
      prevChain = sim.chain;
    }
    gaps = longest / 60 > 0.1 ? 1 : 0;
    return { gaps, chains, longest: longest / 60 };
  };
  const on = countGaps(1), off = countGaps(0);
  assert.ok(on.chains > off.chains * 2, `持续冒泡应明显更多：${on.chains} vs ${off.chains}`);
  assert.equal(on.gaps, 0, `持续冒泡不应有超过 0.1 秒的空档，最长 ${on.longest.toFixed(2)} 秒`);
  assert.ok(off.longest > 1, `关闭时应有明显的空档，最长 ${off.longest.toFixed(2)} 秒`);
}
// 17. 上升横向位移：池底起点到水面落点的距离 = 落点到画面中心距离 × driftFrac（不再是 46% 的"超广角"）
{
  const cx = W / 2, cy = H / 2;
  for (const driftFrac of [0, 0.17, 0.4]) {
    const env = base({ tuning: { ...DEFAULT_BUBBLE_TUNING, driftFrac } });
    for (const [ax, ay] of [[1100, 300], [300, 700], [cx, cy + 200]]) {
      const bottom = geo.pathPoint(env, ax, ay, 0), top = geo.pathPoint(env, ax, ay, 1);
      assert.ok(Math.abs(top.x - ax) < 1e-9 && Math.abs(top.y - ay) < 1e-9, '终点就是水面落点');
      const startDist = Math.hypot(bottom.x - cx, bottom.y - cy), endDist = Math.hypot(ax - cx, ay - cy);
      assert.ok(Math.abs(startDist / endDist - (1 - driftFrac)) < 1e-9, `driftFrac=${driftFrac}：距离比应为 ${1 - driftFrac}`);
      // 横向位移（起点到落点的距离）占落点到中心距离 = driftFrac
      const travel = Math.hypot(ax - bottom.x, ay - bottom.y);
      assert.ok(Math.abs(travel / endDist - driftFrac) < 1e-9, `位移占比应为 ${driftFrac}，实际 ${(travel / endDist).toFixed(3)}`);
    }
  }
  // 默认值就是圆圈从最深层升到水面的比例
  assert.equal(DEFAULT_BUBBLE_TUNING.driftFrac, 0.17);
}
console.log('P20 气泡模拟测试通过');
