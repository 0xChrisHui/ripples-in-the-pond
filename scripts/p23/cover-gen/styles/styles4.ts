// 新封面样图第三批（上）P–T：辐射波纹 / 交织带 / 示波 / 涡街 / 旋转多边形
import { S, C, TAU, poly, line, block, frame, polar, type Pt } from '../lib';

type R = () => number;
const ringBlock = (a: Pt[], b: Pt[]) => poly(a, true) + ' ' + poly(b.slice().reverse(), true);

// ---------- P 辐射波纹：放射直线被同心涟漪“折弯”，部分扇区填色 ----------
export function styleP(r: R): string {
  const R0 = 140 + r() * 30;
  const n = 90 + Math.floor(r() * 90);
  const a = 6 + r() * 10, f = 0.025 + r() * 0.035, ph = r() * TAU;
  const k = 2 + Math.floor(r() * 5), q = r() * TAU;
  const spoke = (th: number, r0: number, r1: number): Pt[] => {
    const pts: Pt[] = [];
    const amp = a * (0.45 + 0.55 * Math.sin(k * th + q));
    for (let d = r0; d <= r1; d += 6) {
      const ang = th + (amp * Math.sin(d * f - ph) * Math.min(1, (d - R0) / 80)) / d;
      pts.push([C + d * Math.cos(ang), C + d * Math.sin(ang)]);
    }
    return pts;
  };
  let body = '';
  for (let j = 0; j < 6 + Math.floor(r() * 6); j++) {
    const i = Math.floor(r() * n), w = 1 + Math.floor(r() * 3);
    const r0 = R0 * 1.1 + r() * 200, r1 = r0 + 80 + r() * 300;
    body += block(poly([...spoke((i / n) * TAU, r0, r1), ...spoke(((i + w) / n) * TAU, r0, r1).reverse()], true), 0.1 + r() * 0.16);
  }
  for (let i = 0; i < n; i++) body += line(poly(spoke((i / n) * TAU, R0 * 1.1, 760)), 0.6 + r() * 1.1, 0.35 + r() * 0.45);
  return frame(body, C, C, R0);
}

// ---------- Q 交织带：两三条正弦缎带绕圆交错，每条由数根平行线组成 ----------
export function styleQ(r: R): string {
  const R0 = 130 + r() * 25;
  const bands = 2 + Math.floor(r() * 2);
  let body = '';
  for (let i = 0; i < 3; i++) {
    const rr = R0 * 1.15 + i * 12;
    body += line(poly(polar(C, C, () => rr, 240), true), 0.7, 0.5 - i * 0.12);
  }
  for (let b = 0; b < bands; b++) {
    const rb = R0 * (1.7 + b * 0.55 + r() * 0.25), A = 30 + r() * 60;
    const k = 3 + Math.floor(r() * 6) + b, p = r() * TAU, w = 22 + r() * 26;
    const lines = 4 + Math.floor(r() * 4);
    const at = (u: number) => polar(C, C, (t) => rb + A * Math.sin(k * t + p) + u * w, 720);
    body += block(ringBlock(at(0.5), at(-0.5)), 0.08 + r() * 0.08);
    for (let j = 0; j < lines; j++) {
      const u = j / (lines - 1) - 0.5;
      body += line(poly(at(u), true), 0.6 + r() * 1.4, Math.abs(u) > 0.45 ? 0.85 : 0.35 + r() * 0.3);
    }
  }
  return frame(body, C, C, R0);
}

// ---------- R 示波：横向排列的声波线，在圆外一圈振幅最大，部分行画成实心波形 ----------
export function styleR(r: R): string {
  const R0 = 130 + r() * 30;
  const rows = 20 + Math.floor(r() * 12);
  const sp = S / (rows + 1);
  const A = sp * (0.55 + r() * 0.35), W = 70 + r() * 90;
  const f = [0.04 + r() * 0.05, 0.13 + r() * 0.12, 0.4 + r() * 0.3];
  const fills = new Set(Array.from({ length: 4 + Math.floor(r() * 4) }, () => Math.floor(r() * rows)));
  let body = '';
  for (let i = 0; i < rows; i++) {
    const y0 = sp * (i + 1);
    const p = [r() * TAU, r() * TAU, r() * TAU];
    const top: Pt[] = [], bot: Pt[] = [];
    for (let x = 0; x <= S; x += 3) {
      const d = Math.hypot(x - C, y0 - C);
      const env = A * (Math.exp(-(((d - R0 * 1.35) / W) ** 2)) + 0.12);
      const s = env * (0.6 * Math.sin(x * f[0] + p[0]) + 0.3 * Math.sin(x * f[1] + p[1]) + 0.1 * Math.sin(x * f[2] + p[2]));
      top.push([x, y0 + s]); bot.push([x, y0 - s]);
    }
    if (fills.has(i)) body += block(poly([...top, ...bot.reverse()], true), 0.15 + r() * 0.15);
    body += line(poly(top), 0.8 + r() * 0.8, 0.45 + r() * 0.35);
  }
  return frame(body, C, C, R0);
}

// ---------- S 涡街：水流绕过日食，下游拖出左右交替的涡旋 ----------
export function styleS(r: R): string {
  const R0 = 110 + r() * 25;
  const al = r() * TAU, ca = Math.cos(al), sa = Math.sin(al);
  const cx = C - ca * 150, cy = C - sa * 150;
  const L = R0 * 1.15;
  const to = (u: number, v: number): Pt => [cx + u * ca - v * sa, cy + u * sa + v * ca];
  const push = (u: number, v: number): Pt => {
    const d = Math.hypot(u, v) || 1e-6, nd = Math.sqrt(d * d + L * L);
    return to((u / d) * nd, (v / d) * nd);
  };
  const wa = 25 + r() * 25, wf = 0.022 + r() * 0.012;
  let body = '';
  const gap = 34 + r() * 22;
  for (let c = -900; c <= 900; c += gap) {
    const pts: Pt[] = [];
    for (let u = -900; u <= 1100; u += Math.abs(u) < L * 1.6 && Math.abs(c) < L * 1.6 ? 1 : 6) {
      const wake = u > 0 ? wa * Math.exp(-((c / (R0 * 2.2)) ** 2)) * Math.sin(u * wf) * Math.min(1, u / (R0 * 2)) : 0;
      pts.push(push(u, c + wake));
    }
    body += line(poly(pts), 0.6 + r() * 1, 0.25 + r() * 0.3);
  }
  const sp = 95 + r() * 35;
  for (let k = 0; k < 8; k++) {
    const side = k % 2 ? 1 : -1, u = R0 * 1.9 + k * sp, v = side * (R0 * 0.6 + k * 10);
    const rv = 45 + k * (10 + r() * 6), turns = 3.5 + r() * 2, T = turns * TAU;
    const [px, py] = to(u, v);
    body += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(rv * 0.95).toFixed(1)}" fill="#fff" fill-opacity="${(0.06 + r() * 0.08).toFixed(2)}"/>`;
    for (let arm = 0; arm < 2; arm++) {
      const pts: Pt[] = [];
      for (let t = 0; t <= T; t += 0.08) {
        const rr = rv * (t / T), a = side * t + arm * Math.PI;
        pts.push([px + rr * Math.cos(a), py + rr * Math.sin(a)]);
      }
      body += line(poly(pts), 0.8 + r() * 1, 0.55 + r() * 0.3);
    }
  }
  return frame(body, cx, cy, R0);
}

// ---------- T 旋转多边形：同心多边形逐层旋转，扭出螺旋感，部分层间填色 ----------
export function styleT(r: R): string {
  const R0 = 130 + r() * 25;
  const n = 3 + Math.floor(r() * 6);
  const m = 28 + Math.floor(r() * 18);
  const g = 11 + r() * 9, tw = (r() < 0.5 ? -1 : 1) * (0.02 + r() * 0.08);
  const r0 = (R0 * 1.15) / Math.cos(Math.PI / n);
  const shape = (i: number): Pt[] => {
    const rr = r0 + i * g, rot = i * tw, pts: Pt[] = [];
    for (let v = 0; v < n; v++) {
      const a = rot + (v / n) * TAU;
      pts.push([C + rr * Math.cos(a), C + rr * Math.sin(a)]);
    }
    return pts;
  };
  let body = '';
  for (let j = 0; j < 3 + Math.floor(r() * 3); j++) {
    const i = Math.floor(r() * (m - 3));
    body += block(ringBlock(shape(i + 1 + Math.floor(r() * 2)), shape(i)), 0.07 + r() * 0.13);
  }
  for (let i = 0; i < m; i++) body += line(poly(shape(i), true), 0.7 + r() * 1.3, Math.max(0.15, 0.85 - (i / m) * 0.6));
  return frame(body, C, C, R0);
}
