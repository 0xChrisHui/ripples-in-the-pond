import type { GlPhysNode } from './gl-sim-setup';
import { renderDepth } from '../pointer-fx';

/**
 * 背景涟漪经过球时给球加 outward velocity（快照自 sphere-sim-setup.ts:145-175，去掉 _perturb）。
 *
 * 移自 /test1 的「球飘动 + 涟漪推」：
 *   driftSpheres —— 给所有球加缓慢准随机游走速度 = "随机飘动"（注入速度、d3 阻尼约束 → 漂而不散）。
 *   pushGlSpheresByWaves 的 depthAtten 模式 —— 只推**水下**球、离水面越远推力越小 = "水中球被点击/切组涟漪推动"。
 * /test3 适配：水下判定用 renderDepth(层模型 + 滚轮 + 球浮动)，与渲染/没入同口径。飘动只动 x/y、与沉浮(深度)正交 → 二者和谐共存。
 */
export interface BgWave { x: number; y: number; size: number; spawnTime: number; duration: number }

/**
 * 球随机飘动：每帧给每个球注入一点缓慢准随机游走速度（两组不可公度正弦合成，x/y 各异）。
 * 注入速度而非直接挪位 → d3 的 velocityDecay 阻尼 + cluster 力会把游走约束在锚点附近（漂而不散）。
 * strength=0 直接跳过；拖拽中的球（fx/fy 锁定）不漂。
 */
export function driftSpheres(nodes: GlPhysNode[], timeSec: number, strength: number): void {
  if (strength <= 0) return;
  for (const n of nodes) {
    if (n.fx != null || n.fy != null || n.x == null || n.y == null) continue;
    const lw = n.lw;
    if (!lw) continue;
    const ax = Math.sin(timeSec * (0.11 + lw.f1) + lw.p1) + 0.7 * Math.cos(timeSec * (0.17 + lw.f2) + lw.p2);
    const ay = Math.cos(timeSec * (0.13 + lw.f2) + lw.p2) + 0.7 * Math.sin(timeSec * (0.19 + lw.f1) + lw.p1);
    n.vx = (n.vx ?? 0) + ax * strength;
    n.vy = (n.vy ?? 0) + ay * strength;
  }
}

// 涟漪推"滑行惯性"参数：GAIN=每帧推力转滑行速度的系数；DECAY=每帧保留比例（越近 1 滑得越久越丝滑）；
// MAX=滑行速度上限（多波叠加防甩飞）。仅 depthAtten（drift 开·点击涟漪）走滑行；导航涟漪仍直接进 d3 vx。
const GLIDE_GAIN = 0.1;
const GLIDE_DECAY = 0.96;
const GLIDE_MAX = 1.5;

/**
 * 涟漪推球：扩张环经过球时给 outward velocity。
 * depthAtten=false（导航涟漪现状）：推全部非播放/非拖拽球，无深度衰减 → 直接进 d3 vx（velocityDecay 快收）。
 * depthAtten=true（球飘动开·点击/切组涟漪）：只推**水下**球（renderDepth<水位），离水面越远（越深）推力越小 → 0；
 *   推力进 _gvx 滑行（慢衰减惯性收尾，见 stepSphereGlide）→ 波过后丝滑滑停。
 *   waterLevel=有效水位；pushScale=推力倍率（面板 wavePush）；pushDepth=衰减深度（离面这么深→推力≈0）。
 */
export function pushGlSpheresByWaves(
  nodes: GlPhysNode[],
  waves: BgWave[],
  playingId: string | null,
  now: number,
  waterLevel = 0,
  depthAtten = false,
  pushScale = 1,
  pushDepth = 0.4,
  waveSpeed = 200, // px/s：推力环从 0 同速扩张 → 前沿与可见水波同步抵达球（≈0.2×画布高，由 SphereInstances 传入）
): void {
  if (waves.length === 0) return;
  for (const n of nodes) {
    if (n.id === playingId || n.fx != null || n.fy != null || n.x == null || n.y == null) continue;
    let atten = 1;
    if (depthAtten) {
      const below = waterLevel - renderDepth(n.z, n._waveZ ?? 0); // >0 = 在水下（层模型有效深度，含球浮动）
      if (below <= 0) continue;                                   // 出水球不被水波推（"水中的球"）
      atten = Math.max(0, 1 - below / Math.max(0.001, pushDepth)) * pushScale; // 离面越远越小
      if (atten <= 0) continue;
    }
    for (const w of waves) {
      const curR = waveSpeed * (now - w.spawnTime) / 1000.0; // 从 0 起按可见水波速度扩张；超出该波 size 即不再作用
      if (curR > w.size) continue;
      const dx = n.x - w.x;
      const dy = n.y - w.y;
      const dd = Math.hypot(dx, dy) || 1;
      const band = 70.0; // 推力带厚度
      const dist = Math.abs(dd - curR);
      if (dist < band) {
        const force = 0.18 * (1 - dist / band) * atten;
        const fx = (dx / dd) * force, fy = (dy / dd) * force;
        if (depthAtten) {
          // 涟漪推（drift 开）：喂独立"滑行"速度 _gvx（慢衰减惯性，stepSphereGlide 收尾）→ 波过后丝滑滑停
          n._gvx = (n._gvx ?? 0) + fx * GLIDE_GAIN;
          n._gvy = (n._gvy ?? 0) + fy * GLIDE_GAIN;
        } else {
          // 导航涟漪（drift 关）：直接进 d3 vx，velocityDecay 快收（现状）
          n.vx = (n.vx ?? 0) + fx;
          n.vy = (n.vy ?? 0) + fy;
        }
      }
    }
  }
}

/**
 * 涟漪推"滑行惯性"收尾：每帧把 _gvx/_gvy（独立于 d3 velocityDecay）直接加到位置 + 慢衰减。
 * → 涟漪波过后球带惯性丝滑滑停（不被 d3 的 0.5 阻尼急停）。直接改 n.x/y → DOM 命中层同步跟随。
 * 拖拽中的球（fx/fy 锁定）不滑；速度衰到极小归 0。drift 关时无人喂 _gvx → 此函数空转。
 */
export function stepSphereGlide(nodes: GlPhysNode[]): void {
  for (const n of nodes) {
    let gx = n._gvx ?? 0, gy = n._gvy ?? 0;
    if (gx === 0 && gy === 0) continue;
    const sp = Math.hypot(gx, gy);
    if (sp > GLIDE_MAX) { const k = GLIDE_MAX / sp; gx *= k; gy *= k; } // 多波叠加封顶，防甩飞
    if (n.fx == null && n.fy == null && n.x != null && n.y != null) { n.x += gx; n.y += gy; }
    gx *= GLIDE_DECAY; gy *= GLIDE_DECAY;
    n._gvx = Math.abs(gx) < 0.003 ? 0 : gx;
    n._gvy = Math.abs(gy) < 0.003 ? 0 : gy;
  }
}
