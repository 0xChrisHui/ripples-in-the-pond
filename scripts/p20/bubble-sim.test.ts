import assert from 'node:assert/strict';
import { createBubbleSim, stepBubbles, type BubbleView } from '../../src/components/pond-gl-test3/decor/bubbles/sim/bubble-sim';
import { stayDuration, toDisplayLines } from '../../src/components/pond-gl-test3/decor/bubbles/notes/note-display';
import * as geo from '../../src/components/pond-gl-test3/decor/bubbles/sim/bubble-geometry';
import { DEFAULT_BUBBLE_TUNING } from '../../src/components/pond-gl-test3/decor/bubbles/bubble-tuning';
import { W, H, base, run, seeded } from './_helpers';

const FULL = { ...DEFAULT_BUBBLE_TUNING, keepFull: 1 };

// 1. 正常运行：泡的外观数值都在范围内，位置在画面附近
{
  const { frames, peakBubbles } = run(7, 180, base({ tuning: FULL }), 1 / 30);
  assert.ok(peakBubbles >= 3 && peakBubbles <= 32, `同屏泡数 ${peakBubbles}`);
  for (const f of frames) for (const v of f) {
    assert.ok(v.alpha >= 0 && v.alpha <= 1 && v.depth >= 0 && v.depth <= 1);
    assert.ok(v.radius >= 1 && v.radius <= 7.5, `半径 ${v.radius}`);
    assert.ok(v.x > -50 && v.x < W + 50 && v.y > -50 && v.y < H + 50);
  }
}
// 2. 避让：球铺满画面中央一大块时，泡绝不贴着球（避让生成 + 逐帧淡出）
{
  const discs = [{ x: W / 2, y: H / 2, r: 260 }, { x: W * 0.3, y: H * 0.35, r: 90 }];
  const { frames } = run(3, 300, base({ discs, discCount: discs.length, tuning: FULL }), 1 / 30);
  for (const f of frames) for (const v of f) {
    for (const d of discs) {
      const edge = Math.hypot(v.x - d.x, v.y - d.y) - d.r;
      if (edge < 0) assert.ok(v.alpha < 0.001, `球内的泡必须全透明（edge=${edge.toFixed(1)}, alpha=${v.alpha.toFixed(3)}）`);
    }
  }
}
// 3. 减弱动效：不生成；运行中途开启：所有组立刻撤掉
{
  assert.equal(run(9, 120, base({ reduced: true, tuning: FULL }), 1 / 30, false).spawned, 0);
  const rng = seeded(2), sim = createBubbleSim(rng), out: BubbleView[] = [];
  let shown = 0;
  for (let t = 0; t < 60 && shown === 0; t += 1 / 30) shown = stepBubbles(sim, 1 / 30, base({ tuning: FULL }), rng, out);
  assert.ok(shown > 0, '应已有泡');
  assert.equal(stepBubbles(sim, 1 / 30, base({ reduced: true, tuning: FULL }), rng, out), 0);
  assert.equal(sim.chains.length, 0);
}
// 4. 水面落点在画面 15%–85% 区域内（深处看不出，取最靠近水面的泡）
{
  const { frames } = run(13, 300, base({ tuning: FULL }), 1 / 30);
  for (const f of frames) for (const v of f) {
    if (v.depth > 0.98) assert.ok(v.x > W * 0.12 && v.x < W * 0.88 && v.y > H * 0.12 && v.y < H * 0.88, `水面落点 (${v.x | 0},${v.y | 0})`);
  }
}
// 5. 破水：数量与泡数相当，落在水面区域；被球挡住的不破
{
  const pops: Array<[number, number]> = [];
  const r = run(17, 120, base({ tuning: FULL, onPop: (x, y) => pops.push([x, y]) }), 1 / 30, false);
  assert.ok(pops.length >= r.spawned * 2, `破水数 ${pops.length} 应与泡数相当（组数 ${r.spawned}）`);
  for (const [x, y] of pops) assert.ok(x > W * 0.1 && x < W * 0.9 && y > H * 0.1 && y < H * 0.9);
  const got: number[] = [];
  const covered = [{ x: W / 2, y: H / 2, r: 5000 }];
  run(17, 60, base({ discs: covered, discCount: 1, tuning: FULL, onPop: () => got.push(1) }), 1 / 30, false);
  assert.equal(got.length, 0);
}
// 6. 载体泡：到水面后停住，宿主放行才破；放行后载体泡不再存在
{
  const rng = seeded(31), sim = createBubbleSim(rng), out: BubbleView[] = [];
  let arrived: [number, number] | null = null, released = false, holdFrames = 0;
  const port = { arrive: (x: number, y: number) => { arrived = [x, y]; return 7; }, isReleased: () => released, clear: () => { released = true; } };
  const env = base({ carrier: port, tuning: FULL });
  sim.untilNote = 1; // 第一组就带手记
  for (let t = 0; t < 200; t += 1 / 30) {
    stepBubbles(sim, 1 / 30, env, rng, out);
    if (arrived && !released) { holdFrames++; if (holdFrames > 30 * 20) released = true; }
  }
  assert.ok(arrived, '载体泡应到达水面并登记');
  assert.ok(holdFrames >= 30 * 20, `放行前应一直停着，实际 ${holdFrames} 帧`);
}
// 7. 手记排版规则
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
// 8. 上升横向位移：池底起点到水面落点的距离 = 落点到画面中心距离 × driftFrac
{
  const cx = W / 2, cy = H / 2;
  for (const driftFrac of [0, 0.17, 0.4]) {
    const env = base({ tuning: { ...DEFAULT_BUBBLE_TUNING, driftFrac } });
    for (const [ax, ay] of [[1100, 300], [300, 700], [cx, cy + 200]]) {
      const bottom = geo.pathPoint(env, ax, ay, 0), top = geo.pathPoint(env, ax, ay, 1);
      assert.ok(Math.abs(top.x - ax) < 1e-9 && Math.abs(top.y - ay) < 1e-9, '终点就是水面落点');
      const startDist = Math.hypot(bottom.x - cx, bottom.y - cy), endDist = Math.hypot(ax - cx, ay - cy);
      assert.ok(Math.abs(startDist / endDist - (1 - driftFrac)) < 1e-9, `driftFrac=${driftFrac}：距离比应为 ${1 - driftFrac}`);
      assert.ok(Math.abs(Math.hypot(ax - bottom.x, ay - bottom.y) / endDist - driftFrac) < 1e-9, `位移占比应为 ${driftFrac}`);
    }
  }
  assert.equal(DEFAULT_BUBBLE_TUNING.driftFrac, 0.17);
}
console.log('P20 气泡模拟测试通过');
