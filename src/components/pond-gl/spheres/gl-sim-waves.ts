import type { GlPhysNode } from './gl-sim-setup';

/**
 * 背景涟漪经过球时给球加 outward velocity（快照自 sphere-sim-setup.ts:145-175，去掉 _perturb）。
 * 从 gl-sim-setup 拆出（J2 加 resizeGlSim 后撞 220 行硬线）——本块与 sim 建立/锚点无耦合，独立成文件最干净。
 *
 * 新效果（sphereDrift）：driftSpheres 给所有球加缓慢准随机游走速度 = "随机飘动"；
 * pushGlSpheresByWaves 的 depthAtten 模式只推水下球、且离水面越远推力越小 = "水中球被点击涟漪推动"。
 */
export interface BgWave { x: number; y: number; size: number; spawnTime: number; duration: number }

/**
 * 球随机飘动：每帧给每个球注入一点缓慢准随机游走速度（两组不可公度正弦合成，x/y 各异）。
 * 注入速度而非直接挪位 → d3 的 velocityDecay 阻尼 + cluster 力会把游走约束在锚点附近（漂而不散）。
 * strength=0 直接跳过（开关关或滑块归零）。拖拽中的球（fx/fy 锁定）不漂。
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

// 涟漪推"滑行惯性"参数：GAIN=把每帧推力转成滑行速度的系数（配合慢衰减≈持平现状的推进速度）；
// DECAY=每帧保留比例（越接近 1 滑得越久越丝滑）；MAX=滑行速度上限（多波叠加时防甩飞）。
const GLIDE_GAIN = 0.1;
const GLIDE_DECAY = 0.96;
const GLIDE_MAX = 1.5;

/**
 * 涟漪推球：扩张环经过球时给 outward velocity。
 * depthAtten=false（现状/导航涟漪）：推全部非播放/非拖拽球，无深度衰减 —— 与改动前逐字一致（进 d3 vx，快收）。
 * depthAtten=true（新效果·点击涟漪）：只推**水下**球（z<水位），离水面越远越小；推力进 _gvx 滑行（惯性收尾，见 stepSphereGlide）。
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
  waveSpeed = 200, // px/s：推力环**从 0 同速扩张** → 前沿与可见水波/高光同步抵达球（≈0.2×画布高，由 SphereInstances 传入）
): void {
  if (waves.length === 0) return;
  for (const n of nodes) {
    if (n.id === playingId || n.fx != null || n.fy != null || n.x == null || n.y == null) continue;
    let atten = 1;
    if (depthAtten) {
      const below = waterLevel - (n.displayZ ?? n.z); // >0 = 在水下
      if (below <= 0) continue;                        // 出水球不被水波推（"水中的球"）
      atten = Math.max(0, 1 - below / Math.max(0.001, pushDepth)) * pushScale; // 离面越远越小
      if (atten <= 0) continue;
    }
    for (const w of waves) {
      // 涟漪环半径 = 速度×经过时间（从 0 起、按可见水波速度扩张）→ 高光划到球的同时推力到；超出该波 size 即不再作用
      const curR = waveSpeed * (now - w.spawnTime) / 1000.0;
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
          // 涟漪推（sphereDrift 开）：喂独立"滑行"速度 _gvx（慢衰减惯性，stepSphereGlide 收尾）→ 波过后丝滑滑停、不急停
          n._gvx = (n._gvx ?? 0) + fx * GLIDE_GAIN;
          n._gvy = (n._gvy ?? 0) + fy * GLIDE_GAIN;
        } else {
          // 现状（导航涟漪 / sphereDrift 关）：直接进 d3 vx，velocityDecay 快收 —— 与改动前逐字一致
          n.vx = (n.vx ?? 0) + fx;
          n.vy = (n.vy ?? 0) + fy;
        }
      }
    }
  }
}

/**
 * 涟漪推"滑行惯性"收尾：每帧把 _gvx/_gvy（独立于 d3 velocityDecay）直接加到位置 + 慢衰减。
 * → 涟漪波过后球带惯性丝滑滑停（不再被 d3 的 0.5 阻尼急停）。直接改 n.x/y → DOM 命中层同步跟随。
 * 拖拽中的球（fx/fy 锁定）不滑；速度衰到极小归 0（停摆）。OFF（sphereDrift 关）时无人喂 _gvx → 此函数空转。
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
