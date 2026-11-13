const assert = require('node:assert/strict');
const test = require('node:test');
const { load } = require('./load.cjs');

function harness() {
  const node = { x: 50, y: 70, z: .5, radius: 14 };
  const events = {}, frames = new Map(), slots = [], effects = new Map();
  let cursor = 0, frameId = 0, now = 0;
  const rect = { left: 100, top: 80, width: 232, height: 232 };
  const sim = { restart() { return this; }, alpha() { return this; }, stop() {}, force() { return { strength() {} }; } };
  const react = {
    useRef: value => slots[cursor++] ??= { current: value },
    useState: initial => {
      const n = cursor++; if (!(n in slots)) slots[n] = n === 0 ? [node] : initial;
      return [slots[n], value => { slots[n] = typeof value === 'function' ? value(slots[n]) : value; }];
    }, useMemo: fn => { cursor++; return fn(); }, useCallback: fn => { cursor++; return fn; },
    useEffect: (fn, deps) => {
      const n = cursor++, old = effects.get(n);
      if (!old || !deps || deps.some((x, i) => x !== old.deps[i])) effects.set(n, { fn, deps, cleanup: old?.cleanup, pending: true });
    },
  };
  const imports = { react, 'd3-force': {},
    '@/src/components/pond-gl-test3/pointer-fx': { getPointerFx: () => ({ mx: 0, my: 0 }), getCameraFx: () => ({}), depthOf: () => .5, resetDepthShift() {} },
    '@/src/components/pond-gl-test3/sphere-projection': { unproject: (x, y) => ({ x, y }), project: () => ({ scale: 1 }) },
    '@/src/components/pond-gl-test3/water/water-level': { getEffectiveWaterLevel: () => .5 },
    '@/src/components/pond-gl-test3/spheres/gl-sim-setup': { buildGlNodes: () => ({ nodes: [node] }), setupGlSimulation: () => ({ sim }) },
    '@/src/components/pond-gl-test3/reduced-motion': { prefersReducedMotion: () => false },
  };
  const window = { innerWidth: 800, innerHeight: 700,
    addEventListener: (type, fn) => { events[type] = fn; },
    removeEventListener: (type, fn) => { if (events[type] === fn) delete events[type]; },
  };
  const api = load('app/(pond)/score/[id]/components/use-score-pond-sim.ts', imports, {
    window, document: { querySelector: () => ({ getBoundingClientRect: () => rect }) },
    queueMicrotask: fn => fn(), performance: { now: () => now },
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  const track = { id: 'score-track' };
  function render(playing) {
    cursor = 0;
    api.useScorePondSim(track, playing, true);
    for (const effect of effects.values()) if (effect.pending) {
      effect.cleanup?.(); effect.cleanup = effect.fn(); effect.pending = false;
    }
  }
  function frame(at) { now = at; const current = [...frames.values()]; frames.clear(); current.forEach(fn => fn(now)); }
  return { node, rect, render, frame, window, resize: () => events.resize(), rotate: () => events.orientationchange() };
}
test('真实Hook：播放中resize和转屏只重算半径，继续自由移动', () => {
  const h = harness(); h.render(true);
  assert.deepEqual([h.node.fx, h.node.fy], [null, null]);
  const position = [h.node.x, h.node.y];
  h.rect.width = h.rect.height = 300; h.window.innerWidth = 1100;
  h.resize(); h.frame(20);
  assert.deepEqual([h.node.fx, h.node.fy], [null, null], 'resize不能重新固定播放中的球');
  assert.deepEqual([h.node.x, h.node.y], position); assert.equal(h.node.radius, 150);
  h.rect.width = h.rect.height = 220; h.rotate(); h.frame(40);
  assert.deepEqual([h.node.fx, h.node.fy], [null, null]); assert.equal(h.node.radius, 110);
});
test('真实Hook：静止resize仍固定到更新后的唱片中心', () => {
  const h = harness(); h.render(false);
  h.rect.left = 200; h.rect.top = 120; h.rect.width = h.rect.height = 300;
  h.resize(); h.frame(20);
  assert.deepEqual([h.node.fx, h.node.fy], [350, 270]); assert.equal(h.node.radius, 150);
});
test('真实Hook：归位中resize不瞬移，动画继续追随新中心', () => {
  const h = harness(); h.render(true); h.node.x = 600; h.node.y = 500;
  h.render(false); h.frame(200);
  h.rect.left = 100; h.rect.top = 100; h.rect.width = h.rect.height = 300;
  h.resize(); h.frame(300);
  assert.notEqual(h.node.fx, 250, '归位未结束，不得因resize直接跳到新中心');
  assert.ok(h.node.fx > 250 && h.node.fx < 600); assert.equal(h.node.radius, 150);
  h.frame(1200); assert.deepEqual([h.node.fx, h.node.fy], [250, 250]);
});
