import type { GlPhysNode } from './gl-sim-setup';

/**
 * 背景涟漪经过球时给球加 outward velocity（快照自 sphere-sim-setup.ts:145-175，去掉 _perturb）。
 * 从 gl-sim-setup 拆出（J2 加 resizeGlSim 后撞 220 行硬线）——本块与 sim 建立/锚点无耦合，独立成文件最干净。
 */
export interface BgWave { x: number; y: number; size: number; spawnTime: number; duration: number }

export function pushGlSpheresByWaves(
  nodes: GlPhysNode[],
  waves: BgWave[],
  playingId: string | null,
  now: number,
): void {
  if (waves.length === 0) return;
  for (const n of nodes) {
    if (n.id === playingId || n.fx != null || n.fy != null || n.x == null || n.y == null) continue;
    for (const w of waves) {
      const ratio = (now - w.spawnTime) / w.duration;
      if (ratio < 0.05 || ratio > 0.85) continue;
      const curR = w.size * (0.15 + ratio * 1.25);
      const dx = n.x - w.x;
      const dy = n.y - w.y;
      const dd = Math.hypot(dx, dy) || 1;
      const band = 70;
      const dist = Math.abs(dd - curR);
      if (dist < band) {
        const force = 0.18 * (1 - dist / band);
        n.vx = (n.vx ?? 0) + (dx / dd) * force;
        n.vy = (n.vy ?? 0) + (dy / dd) * force;
      }
    }
  }
}
