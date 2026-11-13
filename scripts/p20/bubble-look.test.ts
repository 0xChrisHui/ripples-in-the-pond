import assert from 'node:assert/strict';
import { createBubbleSim, stepBubbles, type BubbleView } from '../../src/components/pond-gl-test3/decor/bubbles/sim/bubble-sim';
import { stepOne } from '../../src/components/pond-gl-test3/decor/bubbles/sim/bubble-chain';
import type { Bubble, Chain } from '../../src/components/pond-gl-test3/decor/bubbles/sim/bubble-core';
import { DEFAULT_BUBBLE_TUNING } from '../../src/components/pond-gl-test3/decor/bubbles/bubble-tuning';
import { base, seeded } from './_helpers';

const FULL = { ...DEFAULT_BUBBLE_TUNING, keepFull: 1 };

/** 收集一批自然生成的组（组内泡的参数在生成时就定了，不需要真的推进）。 */
function collectChains(tuning: typeof FULL, runs = 40): Chain[] {
  const all: Chain[] = [];
  for (let seed = 1; seed <= runs; seed++) {
    const rng = seeded(seed), sim = createBubbleSim(rng), out: BubbleView[] = [];
    const seen = new Set<Chain>();
    for (let t = 0; t < 40; t += 1 / 10) {
      stepBubbles(sim, 1 / 10, base({ tuning }), rng, out);
      for (const c of sim.chains) if (!seen.has(c)) { seen.add(c); all.push(JSON.parse(JSON.stringify(c)) as Chain); }
    }
  }
  return all;
}

// F. 横向出生偏移：同组的泡不走同一条线；偏移不超过 birthSpread；为 0 时全为 0
{
  const chains = collectChains(FULL);
  assert.ok(chains.length > 40);
  let distinctGroups = 0;
  for (const c of chains) {
    for (const b of c.bubbles) assert.ok(Math.hypot(b.ox, b.oy) <= FULL.birthSpread + 1e-9, '偏移不应超过 birthSpread');
    const keys = new Set(c.bubbles.map((b) => `${b.ox.toFixed(2)},${b.oy.toFixed(2)}`));
    if (keys.size === c.bubbles.length) distinctGroups++;
  }
  assert.ok(distinctGroups / chains.length > 0.95, '同一组里的泡偏移应各不相同');
  for (const c of collectChains({ ...FULL, birthSpread: 0 }, 10)) for (const b of c.bubbles) assert.ok(b.ox === 0 && b.oy === 0);
}
// G. 大小与速度：大泡升得更快（尺寸与升时负相关）；sizeSpeed=0 时无关；领头泡是最大尺寸
{
  const corr = (tuning: typeof FULL) => {
    const xs: number[] = [], ys: number[] = [];
    for (const c of collectChains(tuning)) for (const b of c.bubbles) { xs.push(b.size); ys.push(b.rise); }
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    return sxy / Math.sqrt(sxx * syy);
  };
  const withLink = corr(FULL), noLink = corr({ ...FULL, sizeSpeed: 0, leadBig: 0 });
  assert.ok(withLink < -0.2, `大泡应升得更快：相关系数 ${withLink.toFixed(3)}`);
  assert.ok(Math.abs(noLink) < 0.1, `关闭后应无关：相关系数 ${noLink.toFixed(3)}`);
  for (const c of collectChains(FULL)) {
    assert.equal(c.bubbles[0].size, FULL.sizeMax, '领头泡取最大尺寸');
    for (const b of c.bubbles.slice(1)) assert.ok(b.size <= FULL.sizeMax * 0.8 + 1e-9, '其余泡偏小');
  }
}
// H. 破水瞬间：停留的最后 popTime 秒放大约 popSwell 并淡出到 0；之前保持不透明
{
  const bubble: Bubble = { delay: 0, rise: 5, dwell: 1, size: 1, ox: 0, oy: 0, sway: 0, freq: 1, phase: 0,
    popped: false, carrier: false, carrierId: 0, held: 0 };
  const chain: Chain = { t: 0, ax: 900, ay: 400, end: 10, bubbles: [bubble], fromBurst: false, retired: false };
  const env = base({ tuning: DEFAULT_BUBBLE_TUNING });
  const view: BubbleView = { x: 0, y: 0, radius: 0, alpha: 0, depth: 0 };
  const at = (t: number) => { chain.t = t; assert.ok(stepOne(chain, bubble, 0, env, view), `t=${t} 应可见`); return { ...view }; };
  const calm = at(5.3);                    // 已到水面、还没到破前阶段
  assert.ok(Math.abs(calm.alpha - 1) < 1e-9, `破前应保持不透明，实际 ${calm.alpha}`);
  const popT = DEFAULT_BUBBLE_TUNING.popTime, swell = DEFAULT_BUBBLE_TUNING.popSwell;
  const peak = at(6 - 0.001);              // 破前最后一刻
  assert.ok(peak.radius > calm.radius * (1 + swell * 0.95), `最后一刻应放大约 ${swell * 100}%：${(peak.radius / calm.radius).toFixed(3)}`);
  assert.ok(peak.alpha < 0.02, `最后一刻应已基本淡出：${peak.alpha}`);
  const end = at(6);                       // 恰好到结束点：完全透明
  assert.ok(Math.abs(end.alpha) < 1e-9, `结束点应完全透明：${end.alpha}`);
  const mid = at(6 - popT / 2);
  assert.ok(mid.radius > calm.radius && mid.radius < peak.radius && mid.alpha < 1 && mid.alpha > peak.alpha, '过程中单调放大并淡出');
  // popSwell=0：不放大
  const flat = base({ tuning: { ...DEFAULT_BUBBLE_TUNING, popSwell: 0 } });
  chain.t = 6 - 0.001; stepOne(chain, bubble, 0, flat, view);
  assert.ok(Math.abs(view.radius - calm.radius) < 1e-9, 'popSwell=0 时半径不变');
  // 停留比 popTime 还短：整个停留期都算破前
  const quick: Bubble = { ...bubble, dwell: 0.05, popped: false };
  chain.bubbles = [quick]; chain.t = 5 + 0.05 - 0.001;
  assert.ok(stepOne(chain, quick, 0, env, view) && view.alpha < 0.1);
}
console.log('P20 观感测试通过');
