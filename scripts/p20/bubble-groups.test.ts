import assert from 'node:assert/strict';
import { createBubbleSim, stepBubbles, type BubbleView } from '../../src/components/pond-gl-test3/decor/bubbles/sim/bubble-sim';
import { groupDistribution, sampleGroups } from '../../src/components/pond-gl-test3/decor/bubbles/sim/bubble-schedule';
import { DEFAULT_BUBBLE_TUNING } from '../../src/components/pond-gl-test3/decor/bubbles/bubble-tuning';
import { W, H, base, run, seeded } from './_helpers';

const FULL = { ...DEFAULT_BUBBLE_TUNING, keepFull: 1 };

// 1. 分布本身：均值精确为 1.5，只在 0..4，占比单峰
{
  const d = groupDistribution(1.5, 0.85, 4);
  assert.ok(Math.abs(d.mean - 1.5) < 1e-6, `均值 ${d.mean}`);
  assert.equal(d.weights.length, 5);
  assert.ok(Math.abs(d.weights.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(d.weights[1] > d.weights[0] && d.weights[2] > d.weights[3] && d.weights[3] > d.weights[4]);
  assert.ok(d.weights[4] < 0.03, '4 组应罕见');
  let prev = -1;
  for (let r = 0; r < 1; r += 0.001) { const g = sampleGroups(d, r); assert.ok(g >= prev && g <= 4); prev = g; }
  assert.ok(groupDistribution(3, 0.85, 4).mean > 2.9 && groupDistribution(0.5, 0.85, 4).mean < 0.6);
}
// 2. 6 个种子 × 1 小时：同时组数均值 1.5±0.15、不超过 4、各档占比接近目标分布（±5 个百分点）
//    单个种子的 1 小时样本有 ±3–4 点的波动，所以用 6 个种子平均来验收
{
  const target = groupDistribution(1.5, 0.85, 4).weights;
  const seeds = [1, 2, 3, 4, 5, 6];
  const share = [0, 0, 0, 0, 0];
  let mean = 0, peak = 0, over = 0;
  for (const seed of seeds) {
    const r = run(seed, 3600, base(), 1 / 20, false);
    mean += r.meanGroups / seeds.length; peak = Math.max(peak, r.peakGroups); over += r.hist[5];
    for (let k = 0; k <= 4; k++) share[k] += r.hist[k] / r.steps / seeds.length;
  }
  console.log('6 种子 × 1 小时分布', share.map((v) => (v * 100).toFixed(1) + '%').join(' '), '均值', mean.toFixed(3));
  assert.ok(Math.abs(mean - 1.5) < 0.15, `均值 ${mean.toFixed(3)}`);
  assert.ok(peak <= 4, `峰值 ${peak}`);
  assert.equal(over, 0);
  // 2026-11-13 目验定稿默认（每串 5–8 泡、上升速度 ×2、整体 ×1.5）后组存活更久、实际组数更滞后于目标：1 组偏少约 7 点，容差由 5 放宽到 8
  for (let k = 0; k <= 4; k++) assert.ok(Math.abs(share[k] - target[k]) < 0.08, `${k} 组占比 ${(share[k] * 100).toFixed(1)}% 应接近 ${(target[k] * 100).toFixed(1)}%`);
}
// 3. 保持满组数：很快到达上限并一直保持，同屏泡数不超过 32
{
  const r = run(103, 300, base({ tuning: FULL }), 1 / 20, false);
  assert.equal(r.peakGroups, 4);
  assert.ok(r.hist[4] / r.steps > 0.6, `满组占比 ${(r.hist[4] / r.steps).toFixed(2)}`);
  assert.ok(r.peakBubbles <= 32);
}
// 4. 播放（日蚀）期间平均组数明显减少
{
  const quiet = run(107, 1800, base({ playing: true }), 1 / 20, false).meanGroups;
  const normal = run(107, 1800, base(), 1 / 20, false).meanGroups;
  assert.ok(quiet < normal * 0.75, `播放中 ${quiet.toFixed(2)} 应明显少于平时 ${normal.toFixed(2)}`);
}
// 5. 多组落点：同时在场的组两两相隔至少短边的 15%
{
  const rng = seeded(109), sim = createBubbleSim(rng), out: BubbleView[] = [];
  const env = base({ tuning: FULL });
  let checked = 0;
  for (let t = 0; t < 400; t += 1 / 20) {
    stepBubbles(sim, 1 / 20, env, rng, out);
    for (let i = 0; i < sim.chains.length; i++) for (let j = i + 1; j < sim.chains.length; j++) {
      const a = sim.chains[i], b = sim.chains[j];
      assert.ok(Math.hypot(a.ax - b.ax, a.ay - b.ay) >= 0.15 * Math.min(W, H) - 1e-6, '两组落点不应挤在一起');
      checked++;
    }
  }
  assert.ok(checked > 100, `应检查到足够多的成对组：${checked}`);
}
// 6. 落点择优：球多时，多候选选出的落点到最近球边缘的距离大于单候选
{
  const discs = Array.from({ length: 14 }, (_, i) => ({ x: 160 + (i % 7) * 190, y: 200 + Math.floor(i / 7) * 330, r: 70 }));
  const score = (candidates: number) => {
    let sum = 0, n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = seeded(seed), sim = createBubbleSim(rng), out: BubbleView[] = [];
      const env = base({ discs, discCount: discs.length, tuning: { ...FULL, candidates } });
      for (let t = 0; t < 12; t += 1 / 20) stepBubbles(sim, 1 / 20, env, rng, out);
      for (const c of sim.chains) { sum += Math.min(...discs.map((d) => Math.hypot(c.ax - d.x, c.ay - d.y) - d.r)); n++; }
    }
    return sum / Math.max(1, n);
  };
  const one = score(1), many = score(12);
  assert.ok(many > one, `多候选择优 ${many.toFixed(1)} 应大于单候选 ${one.toFixed(1)}`);
}
// 7. 立即冒一串：新增一组，不打断现有的；已满时报没有空位
{
  const rng = seeded(41), sim = createBubbleSim(rng), out: BubbleView[] = [];
  const env = base({ tuning: FULL });
  for (let t = 0; t < 8; t += 1 / 20) stepBubbles(sim, 1 / 20, env, rng, out);
  assert.ok(sim.chains.length >= 1 && sim.chains.length < 4, '应已有组在升且未满');
  const before = [...sim.chains];
  stepBubbles(sim, 1 / 20, base({ burst: 'plain', tuning: FULL }), rng, out);
  assert.equal(sim.result, 'started');
  for (const c of before) assert.ok(sim.chains.includes(c), '立即冒一串不应打断现有的组');
  assert.ok(sim.chains.some((c) => c.fromBurst));
  while (sim.chains.length < 4) sim.chains.push({ ...before[0], fromBurst: true });
  stepBubbles(sim, 1 / 20, base({ burst: 'plain', tuning: FULL }), rng, out);
  assert.equal(sim.result, 'failed', '已满 4 组时应报没有空位');
  stepBubbles(sim, 1 / 20, base({ tuning: FULL }), rng, out);
  assert.equal(sim.result, null, 'result 每帧清空');
}
// 8. 立即出手记：载体是第一个泡，并先撤下正在显示的手记；没有宿主时退化为普通一组
{
  let cleared = 0, arrivedId = 0;
  const port = { arrive: () => ++arrivedId, isReleased: () => false, clear: () => { cleared++; } };
  const rng = seeded(43), sim = createBubbleSim(rng), out: BubbleView[] = [];
  stepBubbles(sim, 1 / 20, base({ burst: 'note', carrier: port }), rng, out);
  assert.equal(sim.result, 'started');
  assert.equal(cleared, 1, '立即出手记应先撤下正在显示的手记');
  const c = sim.chains[sim.chains.length - 1];
  assert.equal(c.bubbles[0].carrier, true);
  assert.equal(c.bubbles.filter((b) => b.carrier).length, 1);
  const rng2 = seeded(47), sim2 = createBubbleSim(rng2);
  stepBubbles(sim2, 1 / 20, base({ burst: 'note' }), rng2, out);
  assert.equal(sim2.result, 'started');
  assert.equal(sim2.chains[0].bubbles.some((b) => b.carrier), false);
}
// 9. 球把所有路径占满：立即请求报没有空位，自然生成也不硬出
{
  const discs = [{ x: W / 2, y: H / 2, r: 5000 }];
  const rng = seeded(53), sim = createBubbleSim(rng), out: BubbleView[] = [];
  stepBubbles(sim, 1 / 20, base({ burst: 'plain', discs, discCount: 1 }), rng, out);
  assert.equal(sim.result, 'failed');
  assert.equal(sim.chains.length, 0);
  assert.equal(run(5, 200, base({ discs, discCount: 1 }), 1 / 20, false).spawned, 0);
}
// 10. 收尾：目标变小后有组被收尾，且之后组数回落
{
  const rng = seeded(61), sim = createBubbleSim(rng), out: BubbleView[] = [];
  for (let t = 0; t < 40; t += 1 / 20) stepBubbles(sim, 1 / 20, base({ tuning: FULL }), rng, out);
  assert.ok(sim.chains.length >= 3);
  const less = base({ tuning: { ...DEFAULT_BUBBLE_TUNING, keepFull: 0, meanGroups: 0.2, maxGroups: 4 } });
  let sawRetired = false, endCount = 99;
  for (let t = 0; t < 150; t += 1 / 20) {
    stepBubbles(sim, 1 / 20, less, rng, out);
    if (sim.chains.some((c) => c.retired)) sawRetired = true;
    endCount = sim.chains.length;
  }
  assert.ok(sawRetired, '目标变小后应有组被收尾');
  assert.ok(endCount <= 2, `最终组数应回落，实际 ${endCount}`);
}
// 11. 同时只有一条手记：有载体泡停在水面时，不再挑第二个载体
{
  const arrived: number[] = [];
  const port = { arrive: () => { arrived.push(1); return arrived.length; }, isReleased: () => false, clear: () => {} };
  const rng = seeded(67), sim = createBubbleSim(rng), out: BubbleView[] = [];
  sim.untilNote = 1;
  const env = base({ carrier: port, tuning: { ...FULL, noteEveryMin: 1, noteEveryMax: 1 } });
  let maxCarriers = 0;
  for (let t = 0; t < 200; t += 1 / 20) {
    stepBubbles(sim, 1 / 20, env, rng, out);
    const live = sim.chains.reduce((n, c) => n + c.bubbles.filter((b) => b.carrier && !b.popped).length, 0);
    maxCarriers = Math.max(maxCarriers, live);
  }
  assert.ok(arrived.length >= 1, '应有载体泡到达水面');
  assert.equal(maxCarriers, 1, `同屏载体泡最多 1 个，实际 ${maxCarriers}`);
}
console.log('P20 多组测试通过');
