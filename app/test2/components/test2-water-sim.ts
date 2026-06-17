/**
 * K7 /test2 — 参考水的 CPU 粗网格涟漪 sim（移植自 references/flower-water-ripples）。
 *
 * 纯命令式数组运算，无 React/three 依赖：1:1 搬参考页的 allocSim/drop/stepWater/packSim
 * （5 点拉普拉斯波动方程 + 升余弦滴水 + ±值打包到 [1,254] 字节）。抽成独立模块的原因：
 * ①让 Test2Water.tsx 组件保持在 220 行硬线内；②sim 是命令式 mutate，放模块级函数天然避开
 * react-hooks/immutability。纯实验、不入生产。
 */

// 参考粗网格横向固定 160 格；纵向按屏幕宽高比定（min 90 / max 288），与参考 allocSim 一致
export const NX = 160;

export interface SimState {
  nx: number;
  ny: number;
  u: Float32Array;
  uPrev: Float32Array;
  bytes: Uint8Array; // 打包后的单通道高度场（128=静水基线）
}

/** 参考 allocSim：按屏幕宽高比定纵向格数，分配高度场 / 上一帧 / 打包字节缓冲 */
export function allocSim(w: number, h: number): SimState {
  const ny = Math.max(90, Math.min(288, Math.round(NX * h / Math.max(1, w))));
  const bytes = new Uint8Array(NX * ny);
  bytes.fill(128);
  return { nx: NX, ny, u: new Float32Array(NX * ny), uPrev: new Float32Array(NX * ny), bytes };
}

/** 参考 drop：升余弦核在 (gx,gy) 半径内抬高水面（点击大滴 / 划水小滴 / 常驻微波共用） */
export function drop(s: SimState, gx: number, gy: number, radius: number, strength: number): void {
  const r2 = radius * radius;
  const x0 = Math.max(1, Math.floor(gx - radius)), x1 = Math.min(s.nx - 2, Math.ceil(gx + radius));
  const y0 = Math.max(1, Math.floor(gy - radius)), y1 = Math.min(s.ny - 2, Math.ceil(gy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - gx, dy = y - gy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) {
        const k = Math.cos((Math.sqrt(d2) / radius) * Math.PI * 0.5);
        s.u[y * s.nx + x] += strength * k * k;
      }
    }
  }
}

/** 参考 stepWater：5 点拉普拉斯波动方程一步 + 阻尼，u↔uPrev 交换 */
export function stepWater(s: SimState): void {
  const { nx, ny, u, uPrev } = s;
  const damp = 0.979;
  for (let y = 1; y < ny - 1; y++) {
    const row = y * nx;
    for (let x = 1; x < nx - 1; x++) {
      const i = row + x;
      const v = (u[i - 1] + u[i + 1] + u[i - nx] + u[i + nx]) * 0.5 - uPrev[i];
      uPrev[i] = v * damp;
    }
  }
  const t = s.u; s.u = s.uPrev; s.uPrev = t;
}

/** 参考 packSim：高度场 ±值映射到 [1,254] 字节（128=静水）供单通道纹理上传 */
export function packSim(s: SimState): void {
  const { u, bytes } = s;
  for (let i = 0; i < u.length; i++) {
    const v = 128 + u[i] * 26;
    bytes[i] = v < 1 ? 1 : v > 254 ? 254 : v;
  }
}

/** 视口像素 → 粗网格格点（划水/点击落滴前换算） */
export function pixelToGrid(s: SimState, px: number, py: number, w: number, h: number): [number, number] {
  return [(px / w) * s.nx, (py / h) * s.ny];
}
