import assert from 'node:assert/strict';
import { forceCenter, forceManyBody, type ForceCollide, type ForceManyBody } from 'd3-force';
import { buildGlNodes, setupGlSimulation, type GlPhysNode } from '@/src/components/pond-gl-test3/spheres/gl-sim-setup';
import { reconcileEchoNode, toggleCurrentEcho } from '@/src/components/pond-gl-test3/spheres/simulation/echo-node';
import { advanceSpecial36Transition, getSpecial36Presence } from '@/src/components/pond-gl-test3/special36/special36-step';
import { project } from '@/src/components/pond-gl-test3/sphere-projection';
import { depthOf } from '@/src/components/pond-gl-test3/pointer-fx';
import { HALO_R } from '@/src/components/pond-gl-test3/spheres/sphere-shader';
import { echo, otherEcho, projection, tracks, verifyCrowdedFallback } from './echo-fixtures';

verifyCrowdedFallback();

const motion = (nodes: GlPhysNode[]) => nodes.map(({ id, x, y, vx, vy, fx, fy }) => ({ id, x, y, vx, vy, fx, fy }));
for (const group of ['A', 'B', 'C'] as const) {
  for (const [w, h] of [[1200, 800], [390, 844]]) {
    const proj = { ...projection, cx: w / 2, cy: h / 2 };
    const plain = buildGlNodes(tracks, group, 'I3');
    const logged = buildGlNodes(tracks, group, 'I3');
    const baseline = setupGlSimulation(plain.nodes, plain.links, plain.assignment, w, h, 'I3');
    const { sim, anchors } = setupGlSimulation(logged.nodes, logged.links, logged.assignment, w, h, 'I3');
    baseline.sim.stop(); sim.stop();
    try {
      const initial = structuredClone(logged.nodes);
      const anchorsBefore = structuredClone([...anchors]);
      const sync = (value: typeof echo | null, reduced = false) =>
        reconcileEchoNode(sim, value, group, 'I3', proj, reduced, false);
      const appended = sync(echo);
      assert.equal(appended.length, 36);
      assert.deepEqual(appended.slice(0, 35), initial, '追加不能改动普通球的任何现有字段');
      assert.deepEqual(appended.slice(0, 35), plain.nodes, '有无 Echo 的布局必须完全一致');
      assert.deepEqual(logged.assignment, plain.assignment);
      assert.deepEqual(logged.links, plain.links, '连线与 Echo 无关');
      assert.deepEqual([...anchors], [...baseline.anchors]);
      assert.equal(sim.alpha(), 0.02, '追加只能低 alpha 唤醒');
      const special = appended[35];
      assert.equal(special._presence, 0);
      assert.equal(special.index, 35);
      appended.slice(0, 35).forEach((node, i) => assert.equal(node, logged.nodes[i]));

      const p = project(special.x!, special.y!, depthOf(special), proj, special);
      const r = special.radius * HALO_R * p.scale * 1.12;
      assert.ok(p.sx - r >= 16 && p.sx + r <= w - 16, '出生点整球应留在横向安全区');
      assert.ok(p.sy - r >= 84 && p.sy + r <= h - 16, '出生点避开顶栏');
      assert.ok(p.sx - r >= 132 || p.sy - r >= 230, '出生点避开分组导航');
      assert.ok(logged.nodes.every((n) => Math.hypot(n.x! - special.x!, n.y! - special.y!)
        >= (n.radius + special.radius) * 1.1 + 16), '空旷出生点应避免首帧碰撞');

      advanceSpecial36Transition(special, 0.5, false);
      const progress = special._presence;
      assert.equal(sync({ ...echo }), appended, '同 identity 的新对象不能重复追加');
      assert.equal(special._presence, progress, '同 identity 不能重置渐显');

      // 使用原生 center 作对照，确保普通球手感完全相同且 Echo 不影响中心。
      const expected = logged.nodes.map((n) => ({ ...n }));
      const native = forceCenter<GlPhysNode>(w / 2, h / 2).strength(0.03);
      native.initialize(expected, Math.random);
      native(1);
      const specialBefore = motion([special]);
      sim.force('center')!(1);
      assert.deepEqual(motion(logged.nodes), motion(expected));
      assert.deepEqual(motion([special]), specialBefore);

      // d3.nodes 会把固定节点的位置覆成 fx/fy，追加/移除层必须保留调用前位置。
      logged.nodes[0].fx = 111; logged.nodes[0].fy = 222;
      logged.nodes[0].vx = 0.37; logged.nodes[0].vy = -0.29;
      const beforeRemoval = motion(logged.nodes);
      sync(null);
      assert.equal(sim.nodes().length, 36, '退场到 0 前不能移除');
      advanceSpecial36Transition(special, 0.4, false);
      const elapsed = getSpecial36Presence(special).elapsed;
      sync(null);
      assert.equal(getSpecial36Presence(special).elapsed, elapsed, '重复 null 不重置退场');
      advanceSpecial36Transition(special, 0.95, false);
      assert.equal(sync(null).length, 35);
      assert.deepEqual(motion(logged.nodes), beforeRemoval);
      assert.deepEqual([...anchors], anchorsBefore, '入退场不得修改普通球锚点');

      const next = sync(echo);
      assert.deepEqual(motion(logged.nodes), beforeRemoval, '追加时也保留固定节点的当前位置与速度');
      advanceSpecial36Transition(next[35], 1.5, false);
      assert.equal(sync(otherEcho), next, '换身份时先保留 A 退场');
      assert.equal(next[35].echo?.identity, echo.identity);
      advanceSpecial36Transition(next[35], 1.35, false);
      const replaced = sync(otherEcho);
      assert.equal(replaced.length, 36);
      assert.equal(replaced[35].echo?.identity, otherEcho.identity);
      assert.equal(replaced[35]._presence, 0, 'B 必须重新渐显');
      assert.equal(sync(null, true).length, 35, '减少动态效果时登出立即移除');
      assert.equal(sync(echo, true)[35]._presence, 1);
    } finally { sim.stop(); baseline.sim.stop(); }
  }
}
console.log('I3 三组桌面/手机布局、出生点、节点连续性、身份切换、center 与低 alpha 通过');

// 单独测量原 charge 的首 tick 影响，防止碰撞渐变掩盖了电荷突变。
for (const [w, h] of [[320, 568], [667, 375], [1440, 900]]) {
  let maxCharge = 0;
  for (const group of ['A', 'B', 'C'] as const) {
    const built = buildGlNodes(tracks, group, 'lifecycle');
    const { sim } = setupGlSimulation(built.nodes, built.links, built.assignment, w, h, 'lifecycle');
    sim.stop();
    try {
      for (let i = 0; i < 600; i++) { sim.tick(); sim.on('tick')?.call(sim); }
      const proj = { ...projection, cx: w / 2, cy: h / 2 };
      const nodes = reconcileEchoNode(sim, echo, group, 'lifecycle', proj, false, false);
      const withEcho = nodes.map((n) => ({ ...n })), without = withEcho.slice(0, 35).map((n) => ({ ...n }));
      const charge = sim.force('charge') as ForceManyBody<GlPhysNode>;
      for (const sample of [withEcho, without]) {
        const force = forceManyBody<GlPhysNode>().strength(charge.strength());
        force.initialize(sample, () => 0.5);
        force(sim.alpha() + (sim.alphaTarget() - sim.alpha()) * sim.alphaDecay());
      }
      without.forEach((n, i) => {
        const other = withEcho[i];
        maxCharge = Math.max(maxCharge, Math.hypot(other.vx! - n.vx!, other.vy! - n.vy!) * (1 - sim.velocityDecay()));
      });
      const special = nodes[35], collide = sim.force('collide') as ForceCollide<GlPhysNode>;
      advanceSpecial36Transition(special, 1.5, false);
      const presence = getSpecial36Presence(special);
      for (const phase of ['visible', 'out', 'hidden', 'in'] as const) {
        presence.phase = phase; presence.value = 0.25; special._presence = 0.25;
        assert.equal(collide.radius()(special, 35, nodes), special.radius * 1.1 + 8, '自然隐现不改变原碰撞手感');
      }
    } finally { sim.stop(); }
  }
  console.log(`${w}×${h} 原 charge 首 tick 最大额外位移：${maxCharge}px`);
  assert.ok(maxCharge <= 2, `${w}×${h} 原 charge 超过 2px，需要按 presence 渐入`);
}

async function verifyPlaybackDelegation() {
  const built = buildGlNodes(tracks, 'A', 'playback');
  const { sim } = setupGlSimulation(built.nodes, built.links, built.assignment, 1200, 800, 'playback');
  sim.stop();
  let plays = 0;
  const play = async () => { plays++; };
  const sync = (value: typeof echo | null) => reconcileEchoNode(sim, value, 'A', 'playback', projection, false, false);
  try {
    await toggleCurrentEcho(sim, echo, play);
    assert.equal(plays, 0, '尚未出现的 Echo 不能委托播放');
    const a = sync(echo)[35];
    await toggleCurrentEcho(sim, echo, play);
    assert.equal(plays, 0, '入场低于命中阈值时也拒绝残留的键盘事件');
    advanceSpecial36Transition(a, 1.5, false);
    await toggleCurrentEcho(sim, echo, play);
    assert.equal(plays, 1);
    sync(otherEcho);
    await toggleCurrentEcho(sim, otherEcho, play);
    await toggleCurrentEcho(sim, echo, play);
    assert.equal(plays, 1, '点击退场 A 既不能误播 B，也不能恢复 A');
    advanceSpecial36Transition(a, 1.35, false);
    const b = sync(otherEcho)[35];
    advanceSpecial36Transition(b, 1.5, false);
    await toggleCurrentEcho(sim, echo, play);
    assert.equal(plays, 1, '旧身份回调不能操作 B');
    await toggleCurrentEcho(sim, otherEcho, play);
    assert.equal(plays, 2, 'B 入场后正常播放');
    sync(null);
    await toggleCurrentEcho(sim, null, play);
    assert.equal(plays, 2);
  } finally { sim.stop(); }
  console.log('I3 播放委托的身份、退场与命中阈值保护通过');
}
void verifyPlaybackDelegation().catch((error: unknown) => { console.error(error); process.exitCode = 1; });

// I6 目验反馈：出生点不能每次都落在同一角，应在不碰撞的空位中随机。
{
  const [w, h] = [1200, 800];
  const proj = { ...projection, cx: w / 2, cy: h / 2 };
  const regions = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const built = buildGlNodes(tracks, 'A', 'I3');
    const { sim } = setupGlSimulation(built.nodes, built.links, built.assignment, w, h, 'I3');
    sim.stop();
    const special = reconcileEchoNode(sim, echo, 'A', 'I3', proj, false, false)[35];
    assert.ok(built.nodes.every((n) => Math.hypot(n.x! - special.x!, n.y! - special.y!)
      >= (n.radius + special.radius) * 1.1 + 16), '随机出生点仍须避开首帧碰撞');
    regions.add(`${Math.floor(special.x! / (w / 3))},${Math.floor(special.y! / (h / 3))}`);
  }
  assert.ok(regions.size >= 3, `40 次出生只落在 ${regions.size} 个九宫格区域，不够随机`);
  console.log(`I6 出生点随机：40 次落在 ${regions.size} 个九宫格区域`);
}
