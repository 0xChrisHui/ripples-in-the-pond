import assert from 'node:assert/strict';
import { easeToward, pickCircle, placePanel, placeDrawer, ringAim, type Circle } from '../../src/features/lens/lens-geometry';

const drawerView = { w: 390, h: 844, topInset: 64 };
assert.equal(placeDrawer({ id: 'x', x: 195, y: 780, r: 30, echo: false }, 64, drawerView).side, 'top');
assert.equal(placeDrawer({ id: 'x', x: 195, y: 95, r: 20, echo: false }, 64, drawerView).side, 'bottom');
assert.equal(placeDrawer({ id: 'x', x: 195, y: 700, r: 30, echo: false }, 400, drawerView).side, 'top');
assert.equal(placeDrawer({ id: 'x', x: 195, y: 410, r: 300, echo: false }, 400, drawerView).side, 'bottom');
assert.ok(placeDrawer({ id: 'x', x: 195, y: 410, r: 300, echo: false }, 1000, drawerView).maxH <= 844 * .55);

const circles: Circle[] = [
  { id: 'a', x: 100, y: 100, r: 40, echo: false },
  { id: 'b', x: 130, y: 100, r: 40, echo: false },
  { id: 'echo', x: 400, y: 300, r: 30, echo: true },
];
// 命中与未命中
assert.equal(pickCircle(circles, 100, 100)?.id, 'a');
assert.equal(pickCircle(circles, 135, 100)?.id, 'b');
assert.equal(pickCircle(circles, 250, 250), null);
assert.equal(pickCircle(circles, 400, 300)?.echo, true);
// 容差只在传入时生效
assert.equal(pickCircle(circles, 400, 335), null);
assert.equal(pickCircle(circles, 400, 335, 10)?.id, 'echo');

// 缓动：单调趋近、到位后不抖、tau<=0 直达
let v = 0;
for (let i = 0; i < 40; i++) { const next = easeToward(v, 100, 16, 80); assert.ok(next >= v); v = next; }
assert.equal(v, 100);
assert.equal(easeToward(5, 100, 16, 0), 100);
assert.ok(easeToward(0, 100, 16, 80) < 100 && easeToward(0, 100, 16, 80) > 0);

// 面板：优先右侧；右放不下换左；都放不下换下/上；永不越界、不压顶栏
const view = { w: 1440, h: 900, topInset: 72 };
const size = { w: 300, h: 360 };
const inBounds = (p: { left: number; top: number }) =>
  p.left >= 12 && p.left + size.w <= view.w - 12 && p.top >= view.topInset + 12 && p.top + size.h <= view.h - 12;
const mid = placePanel({ id: 'm', x: 700, y: 450, r: 50, echo: false }, size, view);
assert.equal(mid.side, 'right'); assert.ok(inBounds(mid));
const rightEdge = placePanel({ id: 'r', x: 1380, y: 450, r: 50, echo: false }, size, view);
assert.equal(rightEdge.side, 'left'); assert.ok(inBounds(rightEdge));
const topEdge = placePanel({ id: 't', x: 700, y: 20, r: 30, echo: false }, size, view);
assert.ok(inBounds(topEdge));
const corner = placePanel({ id: 'c', x: 1420, y: 880, r: 40, echo: false }, size, view);
assert.ok(inBounds(corner));
// 迟滞：已在左侧且仍放得下，不跳回右侧
assert.equal(placePanel({ id: 'm', x: 700, y: 450, r: 50, echo: false }, size, view, 'left').side, 'left');
// 手机竖屏：宽 390，只能上/下，且完整在画面内
const phone = { w: 390, h: 844, topInset: 64 };
const phoneSize = { w: 358, h: 420 };
const p = placePanel({ id: 'p', x: 195, y: 300, r: 40, echo: false }, phoneSize, phone);
assert.ok(p.left >= 12 && p.left + phoneSize.w <= phone.w - 12 && p.top >= 76 && p.top + phoneSize.h <= phone.h - 12);
assert.ok(p.side === 'below' || p.side === 'above');
// 手机竖屏 + 高面板 + 球在屏幕中部：不盖住球，内部滚动（maxH），完整在画面内
const tall = { w: 300, h: 483 };
const t2 = placePanel({ id: 't', x: 225, y: 563, r: 11, echo: false }, tall, phone);
assert.ok(t2.maxH != null && t2.maxH >= 160, `应压低高度：${JSON.stringify(t2)}`);
assert.ok(t2.top + t2.maxH <= phone.h - 12 && t2.top >= 76);
assert.ok(563 < t2.top || 563 > t2.top + t2.maxH, '面板不得盖住球');
const t3 = placePanel({ id: 't', x: 100, y: 200, r: 11, echo: false }, tall, phone);
assert.ok(t3.top >= 76 && t3.top + (t3.maxH ?? tall.h) <= phone.h - 12);
assert.ok(200 < t3.top || 200 > t3.top + (t3.maxH ?? tall.h), '面板不得盖住球');
// 光圈瞄准：离开窗口保留最后位置（不回中心）、越界夹到视口内、选中优先、从未有指针才居中
assert.deepEqual(ringAim({ x: 700, y: 0, has: true }, null, 1440, 900), { x: 700, y: 0 }, '边缘停留，不回中心');
assert.deepEqual(ringAim({ x: 1450, y: -4, has: true }, null, 1440, 900), { x: 1440, y: 0 }, '越界夹到视口内');
assert.deepEqual(ringAim(null, null, 1440, 900), { x: 720, y: 450 }, '从未有指针：画面中心');
assert.deepEqual(ringAim({ x: 0, y: 0, has: false }, null, 1440, 900), { x: 720, y: 450 }, '未收到坐标：画面中心');
assert.deepEqual(ringAim({ x: 5, y: 5, has: true }, { id: 'p', x: 300, y: 200, r: 20, echo: false }, 1440, 900), { x: 300, y: 200 }, '锁定球心优先');
console.log('lens-geometry ✅');
