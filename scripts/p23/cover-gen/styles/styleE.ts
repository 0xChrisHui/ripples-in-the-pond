// 风格 E 绕流线（从 gen.ts 抽出，供批量出图使用）
import { C, TAU, poly, line, block, frame, type Pt } from '../lib';

export function styleE(r: () => number): string {
  const R = 140 + r() * 30;
  const R0 = R * 1.12;
  const alpha = r() * Math.PI;
  const ca = Math.cos(alpha), sa = Math.sin(alpha);
  const waveA = 3 + r() * 8, waveF = 0.01 + r() * 0.02, waveP = r() * TAU;
  // 流函数 ψ = y(1 - R0²/r²) 的等值线：给定 x 二分求 y（y>0 时单调）
  const solve = (x: number, c: number) => {
    let lo = Math.sqrt(Math.max(0, R0 * R0 - x * x)) + 1e-3, hi = c + R0;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (m * (1 - (R0 * R0) / (x * x + m * m)) < c) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  };
  const stream = (c: number, sign: number): Pt[] => {
    const pts: Pt[] = [];
    for (let x = -760; x <= 760; x += 8) {
      const yy = solve(x, c);
      const near = Math.min(1, Math.max(0, (Math.hypot(x, yy) - R0) / R0));
      const y = sign * (yy + waveA * near * Math.sin(x * waveF + waveP + c * 0.02));
      pts.push([C + x * ca - y * sa, C + x * sa + y * ca]);
    }
    return pts;
  };
  const cs: number[] = [];
  let c = 6 + r() * 6;
  while (c < 720) { cs.push(c); c += 10 + r() * 34; }
  let body = '';
  for (const sign of [1, -1]) {
    const lines = cs.map((v) => stream(v, sign));
    for (let j = 0; j < 2 + Math.floor(r() * 3); j++) {
      const i = Math.floor(r() * (lines.length - 1));
      body += block(poly([...lines[i], ...lines[i + 1].slice().reverse()], true), 0.05 + r() * 0.12);
    }
    lines.forEach((p, i) => { body += line(poly(p), 0.7 + r() * 2.2, Math.max(0.18, 0.85 - (i / lines.length) * 0.6)); });
  }
  return frame(body, C, C, R);
}

