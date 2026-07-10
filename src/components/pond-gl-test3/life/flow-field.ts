/**
 * P8-L L2-3 流场游移 —— 解析式 curl noise（暗流场）。
 *
 * 用 3 个不同向 / 不同波长（黄金比频率族）/ 不同时相的正弦"流函数势场" Ψ 叠加，
 * 取二维 curl `(∂Ψ/∂y, −∂Ψ/∂x)` 得**无散度**速度场：邻近球被同一股暗流带动（空间相干=洋流感），
 * 又因无散度 → 不会把球往一处汇聚/爆散。偏导全部解析求出（不引噪声库）。
 * 输入 (x,y) 已由调用方乘 flowScale（空间尺度）、t 已乘 flowSpeed（演化速度）。
 */

const PHI = 1.618;      // 黄金比：第二组频率
const PHI2 = 2.618;     // φ²：第三组频率（与前两组不可公度 → 群体永不齐步）

/** 位置(缩放后)+时间 → 暗流速度 [vx, vy]（无量纲，调用方再乘 flowStrength·lifeEnv）。 */
export function flowAt(x: number, y: number, t: number): [number, number] {
  let vx = 0;
  let vy = 0;
  // Ψ1 = sin(x + t)·cos(y)          → (∂/∂y, −∂/∂x)
  vx += -Math.sin(x + t) * Math.sin(y);
  vy += -Math.cos(x + t) * Math.cos(y);
  // Ψ2 = cos(φx)·sin(φy − φt)（权 0.7）
  vx += 0.7 * PHI * Math.cos(PHI * x) * Math.cos(PHI * y - PHI * t);
  vy += 0.7 * PHI * Math.sin(PHI * x) * Math.sin(PHI * y - PHI * t);
  // Ψ3 = sin(φ²x − 0.4t)·sin(φ²y)（权 0.5）
  vx += 0.5 * PHI2 * Math.sin(PHI2 * x - 0.4 * t) * Math.cos(PHI2 * y);
  vy += -0.5 * PHI2 * Math.cos(PHI2 * x - 0.4 * t) * Math.sin(PHI2 * y);
  return [vx, vy];
}
