import assert from 'node:assert/strict';
import { HOVER_IDLE, LEAVE_GRACE_MS, SWITCH_DWELL_MS, stepHover, type HoverState } from '../../src/features/lens/hover/lens-hover';
import type { Circle } from '../../src/features/lens/lens-geometry';

// 一排紧挨着的球（r=14，间距 30，几乎相切）：模拟密集区。
const row: Circle[] = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, x: 100 + i * 30, y: 300, r: 14, echo: false }));
const FRAME = 16;

/** 一帧一帧推进，返回最终状态；pointer=null 表示没有鼠标指针。 */
function run(state: HoverState, from: number, frames: number, pointer: (t: number) => { x: number; y: number } | null,
  inPanel = false, circles = row): { state: HoverState; now: number } {
  let s = state; let now = from;
  for (let i = 0; i < frames; i++) {
    now += FRAME;
    s = stepHover(s, { now, pointer: pointer(i), circles, inPanel });
  }
  return { state: s, now };
}
const at = (x: number) => () => ({ x, y: 300 });

// 1. 静止在球上：停留超过 dwell 才显示
let r = run(HOVER_IDLE, 0, Math.ceil(SWITCH_DWELL_MS / FRAME) + 1, at(100));
assert.equal(r.state.shown, 'c0', '停留超过切换时长后显示');
assert.equal(run(HOVER_IDLE, 0, 3, at(100)).state.shown, null, '刚进入时不立即显示（防误触）');

// 2. 快速横扫密集区：中途经过的球不触发切换，面板保持第一个球
const rest = run(HOVER_IDLE, 0, 20, at(130)).state; // 停在 c1
assert.equal(rest.shown, 'c1');
let sweep = { state: rest, now: 20 * FRAME, switched: 0 };
for (let i = 0; i < 40; i++) {
  const x = 130 + i * 6; // 约 0.4px/ms，每球约 70ms 扫过
  sweep.now += FRAME;
  const next = stepHover(sweep.state, { now: sweep.now, pointer: { x, y: 300 }, circles: row, inPanel: false });
  if (next.shown !== sweep.state.shown) sweep.switched++;
  sweep.state = next;
}
assert.equal(sweep.switched, 0, '扫过的球不应引起面板切换');
assert.equal(sweep.state.shown, 'c1', '扫完仍在 c1（指针不在任何停留的新球上）');

// 3. 停在新球上超过 dwell 后才切换
r = run(sweep.state, sweep.now, Math.ceil(SWITCH_DWELL_MS / FRAME) + 2, at(100 + 9 * 30));
assert.equal(r.state.shown, 'c9', '停留后切换到 c9');

// 4. 面板上：保持，底下即使有别的球也不换
let p = run(r.state, r.now, 60, () => ({ x: 130 + 2 * 30, y: 300 }), true);
assert.equal(p.state.shown, 'c9', '指针在面板上时保持原目标');
p = run(p.state, p.now, 60, () => ({ x: 130 + 3 * 30, y: 300 }), true);
assert.equal(p.state.shown, 'c9', '面板上方向底下球移动也不切换');

// 5. 移开面板到缝隙：宽限内仍保留，超过宽限撤下
const gap = run(p.state, p.now, Math.floor(LEAVE_GRACE_MS / FRAME) - 2, () => ({ x: 9999, y: 9999 }));
assert.equal(gap.state.shown, 'c9', '宽限内保留');
const gone = run(gap.state, gap.now, 5, () => ({ x: 9999, y: 9999 }));
assert.equal(gone.state.shown, null, '超过宽限撤下');
assert.deepEqual(gone.state, HOVER_IDLE);

// 6. 短暂离开再回到同一球：不撤下（跨缝）
const shown = run(HOVER_IDLE, 0, 20, at(100)).state;
const blink = run(shown, 400, 3, () => ({ x: 9999, y: 9999 }));
const back = run(blink.state, blink.now, 3, at(100));
assert.equal(back.state.shown, 'c0', '缝隙时间短于宽限，不撤下');

// 7. 已显示的球：指针在 HOLD 范围内（盖住相邻球）不切换
const held = run(HOVER_IDLE, 0, 20, at(100)).state; // c0 显示
// c0 半径 14，HOLD 16.8；x=112 距 c0 中心 12，仍在 HOLD 内，虽然已进入 c1 的命中圆
const inOverlap = run(held, 400, 60, () => ({ x: 112, y: 300 }));
assert.equal(inOverlap.state.shown, 'c0', '指针在 HOLD 内时不切换');

// 8. 没有鼠标（触屏）：不切换，由 pinned 选中决定，这里只验证撤下
assert.equal(run(held, 400, 30, () => null).state.shown, null, '无指针时撤下');

// 9. #36（echo）不出面板：指针落在 echo 上视为离开
const withEcho: Circle[] = [...row, { id: 'echo', x: 600, y: 300, r: 20, echo: true }];
const onEcho = run(HOVER_IDLE, 0, 20, () => ({ x: 600, y: 300 }), false, withEcho);
assert.equal(onEcho.state.shown, null, 'echo 不显示面板');

// 10. 密集区空隙：球之间有间隔，指针停在空隙里远超宽限，面板仍保持（不合上再开）
const spaced: Circle[] = [
  { id: 'a', x: 100, y: 300, r: 8, echo: false },
  { id: 'b', x: 140, y: 300, r: 8, echo: false },
];
const shownA = run(HOVER_IDLE, 0, 20, () => ({ x: 100, y: 300 }), false, spaced).state;
const inGap = run(shownA, 400, 60, () => ({ x: 120, y: 300 }), false, spaced); // 空隙，远超 LEAVE_GRACE
assert.equal(inGap.state.shown, 'a', '空隙中仍在邻近范围：面板保持');
// 11. 扫到另一个球上：正常切换（不被空隙规则挡住）
const onB = run(inGap.state, inGap.now, 20, () => ({ x: 140, y: 300 }), false, spaced);
assert.equal(onB.state.shown, 'b', '扫到 b 上并停留后切换');
// 12. 离开邻近范围到远处：超过宽限才撤下
const far = run(shownA, 400, 40, () => ({ x: 400, y: 300 }), false, spaced);
assert.equal(far.state.shown, null, '远离后撤下');

console.log('lens-hover ✅');

// 13. 鼠标离开页面（away，如去操作 MetaMask 窗口）：已显示的面板保持，不启动离开计时；回到页面后按位置决定
{
  const circles = [{ id: 'a', x: 300, y: 300, r: 60, echo: false }];
  let state: HoverState = { shown: 'a', candidate: null, since: 0, leftAt: null };
  for (let now = 0; now <= 20000; now += 100) {
    state = stepHover(state, { now, pointer: null, circles, inPanel: false, away: true });
    assert.equal(state.shown, 'a', `鼠标在页面外 ${now}ms 后面板不应撤下`);
    assert.equal(state.leftAt, null, '不应记录离开时刻');
  }
  // 回到页面、落在空白处：此时才开始离开计时，宽限后撤下
  let gone = state;
  for (let now = 20000; now <= 21000; now += 50) gone = stepHover(gone, { now, pointer: { x: 900, y: 700 }, circles, inPanel: false });
  assert.equal(gone.shown, null, '回到页面后落在空白处，超过宽限应撤下');
  // 本来没有面板时不受影响
  assert.deepEqual(stepHover(HOVER_IDLE, { now: 1, pointer: null, circles, inPanel: false, away: true }), HOVER_IDLE);
  // 触屏没有鼠标（away 不成立）：仍按旧规则撤下
  let touch: HoverState = { shown: 'a', candidate: null, since: 0, leftAt: null };
  for (let now = 0; now <= 1000; now += 50) touch = stepHover(touch, { now, pointer: null, circles, inPanel: false });
  assert.equal(touch.shown, null, '触屏无鼠标时应撤下');
}
console.log('lens-hover 13 ✅');
