// 新封面样图第三批（下）U–Y：极光帘 / 星尘环 / 波面网格 / 圆相笔触 / 环缘涟漪
import { C, TAU, f1, poly, line, block, frame, polar, type Pt } from '../lib';

type R = () => number;
const dot = (x: number, y: number, rr: number, o: number) =>
  `<circle cx="${f1(x)}" cy="${f1(y)}" r="${rr.toFixed(2)}" fill="#fff" fill-opacity="${o.toFixed(2)}"/>`;
const circ = (x: number, y: number, rr: number, w: number, o: number) =>
  `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(rr)}" fill="none" stroke="#fff" stroke-width="${w.toFixed(2)}" stroke-opacity="${o.toFixed(2)}"/>`;

// ---------- U 极光帘：从圆周外一圈垂下的摆动细线，越往下越淡，少量缎带色块 ----------
export function styleU(r: R): string {
  const R0 = 125 + r() * 25;
  const cy = C - 90 - r() * 50;
  const n = 120 + Math.floor(r() * 80);
  const k = 3 + Math.floor(r() * 5), p = r() * TAU, sf = 0.01 + r() * 0.012;
  const curtain = (th: number): Pt[] => {
    const rs = R0 * 1.2 + 14 * Math.sin(k * th + p);
    const x0 = C + rs * Math.cos(th), y0 = cy + rs * Math.sin(th);
    const len = 160 + 260 * (0.5 + 0.5 * Math.sin(k * th * 0.5 + p * 2));
    const sw = 10 + Math.abs(Math.cos(th)) * 30, ph = th * 3;
    const pts: Pt[] = [];
    for (let s = 0; s <= len; s += 6) pts.push([x0 + sw * (s / len) * Math.sin(s * sf * 3 + ph), y0 + s]);
    return pts;
  };
  let body = '';
  for (let j = 0; j < 3 + Math.floor(r() * 3); j++) {
    const th = r() * TAU, dth = 0.05 + r() * 0.12;
    body += block(poly([...curtain(th), ...curtain(th + dth).reverse()], true), 0.07 + r() * 0.08);
  }
  for (let i = 0; i < n; i++) {
    const pts = curtain((i / n) * TAU + r() * 0.01);
    const seg = Math.ceil(pts.length / 4);
    for (let s = 0; s < 4; s++) {
      const part = pts.slice(s * seg, (s + 1) * seg + 1);
      if (part.length > 1) body += line(poly(part), 0.6 + r() * 0.8, (0.75 - s * 0.18) * (0.6 + r() * 0.4));
    }
  }
  return frame(body, C, cy, R0);
}

// ---------- V 星尘环：数千颗细点按几条起伏的环带分布，少量大光斑与斜轨道 ----------
export function styleV(r: R): string {
  const R0 = 135 + r() * 25;
  const bands = Array.from({ length: 3 + Math.floor(r() * 3) }, (_, i) => ({
    rb: R0 * (1.3 + i * 0.45 + r() * 0.2), w: 8 + r() * 26, k: 2 + Math.floor(r() * 6), p: r() * TAU, a: 6 + r() * 26,
  }));
  const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r());
  let body = '';
  for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
    const rx = R0 * (1.8 + r() * 1.6), ry = rx * (0.25 + r() * 0.35), rot = r() * 180;
    body += `<ellipse cx="${C}" cy="${C}" rx="${f1(rx)}" ry="${f1(ry)}" transform="rotate(${f1(rot)} ${C} ${C})" fill="none" stroke="#fff" stroke-width="0.8" stroke-opacity="${(0.2 + r() * 0.25).toFixed(2)}"/>`;
  }
  for (let i = 0; i < 6 + Math.floor(r() * 8); i++) {
    const b = bands[Math.floor(r() * bands.length)], t = r() * TAU, d = b.rb + b.a * Math.sin(b.k * t + b.p);
    body += dot(C + d * Math.cos(t), C + d * Math.sin(t), 6 + r() * 14, 0.07 + r() * 0.12);
  }
  const N = 2600 + Math.floor(r() * 1400);
  for (let i = 0; i < N; i++) {
    const b = bands[Math.floor(r() * bands.length)], t = r() * TAU;
    const d = b.rb + b.a * Math.sin(b.k * t + b.p) + b.w * gauss();
    if (d < R0 * 1.08) continue;
    body += dot(C + d * Math.cos(t), C + d * Math.sin(t), 0.5 + Math.pow(r(), 3) * 2, 0.3 + r() * 0.6);
  }
  return frame(body, C, C, R0);
}

// ---------- W 波面网格：日食悬在天上，下方是透视的水面网格，落点处涟漪起伏 ----------
export function styleW(r: R): string {
  const R0 = 95 + r() * 25;
  const cy = 260 + r() * 50;
  const yh = cy + R0 + 45 + r() * 30;
  const F = 520, Zn = 0.9, Zf = 14;
  const X0 = (r() - 0.5) * 2, Z0 = 2 + r() * 2.5;
  const A = 0.06 + r() * 0.06, fr = 2.4 + r() * 2, dec = 2.5 + r() * 2.5, ph = r() * TAU;
  const h = (X: number, Z: number) => {
    const d = Math.hypot(X - X0, Z - Z0);
    return A * Math.sin(d * fr - ph) * Math.exp(-d / dec) + 0.015 * Math.sin(X * 1.7 + Z * 0.9);
  };
  const pj = (X: number, Z: number): Pt => [C + (X * F) / Z, yh + ((1 - h(X, Z)) * F * 0.9) / Z];
  const zs = Array.from({ length: 34 }, (_, i) => Zn * Math.pow(Zf / Zn, i / 33));
  let body = '';
  for (let j = 0; j < 4 + Math.floor(r() * 5); j++) {
    const i = Math.floor(r() * 18), X = Math.floor((r() - 0.5) * 16) * 0.35;
    const pts: Pt[] = [];
    for (let s = 0; s <= 6; s++) pts.push(pj(X + (s / 6) * 0.35, zs[i]));
    for (let s = 6; s >= 0; s--) pts.push(pj(X + (s / 6) * 0.35, zs[i + 1]));
    body += block(poly(pts, true), 0.1 + r() * 0.15);
  }
  zs.forEach((Z, i) => {
    const xm = ((C + 20) * Z) / F, pts: Pt[] = [];
    for (let X = -xm; X <= xm; X += (5 * Z) / F) pts.push(pj(X, Z));
    body += line(poly(pts), 0.6 + (1 - i / 33) * 1.2, 0.2 + (1 - i / 33) * 0.6);
  });
  for (let X = -6; X <= 6.001; X += 0.35) {
    const pts: Pt[] = [];
    for (let Z = Zn; Z <= 7; Z *= 1.04) pts.push(pj(X, Z));
    body += line(poly(pts), 0.7, 0.3);
  }
  return frame(body, C, cy, R0);
}

// ---------- X 圆相笔触：一两笔不闭合的干笔圆环，由几十根细丝组成，带飞白 ----------
export function styleX(r: R): string {
  const R0 = 135 + r() * 25;
  const strokes = 1 + Math.floor(r() * 3);
  let body = '';
  for (let s = 0; s < strokes; s++) {
    const rb = R0 * (1.35 + s * 0.5 + r() * 0.25), a0 = r() * TAU, sweep = 4.3 + r() * 1.6;
    const W = 22 + r() * 40, nl = 18 + Math.floor(r() * 18), dir = r() < 0.5 ? 1 : -1;
    const wk = 2 + Math.floor(r() * 3), wp = r() * TAU, wa = 4 + r() * 10;
    const at = (t: number, u: number): Pt => {
      const w = W * Math.min(1, t / 0.06) * (1 - 0.75 * t ** 3);
      const d = rb + wa * Math.sin(wk * t * TAU * 0.3 + wp) + u * w;
      const a = a0 + dir * sweep * t;
      return [C + d * Math.cos(a), C + d * Math.sin(a)];
    };
    const edge = (u: number) => Array.from({ length: 121 }, (_, i) => at((i / 120) * 0.92, u));
    body += block(poly([...edge(-0.35), ...edge(0.35).reverse()], true), 0.06 + r() * 0.08);
    for (let j = 0; j < nl; j++) {
      const u = j / (nl - 1) - 0.5, end = 1 - r() * 0.3;
      let t = r() * 0.03;
      while (t < end) {
        const len = 0.08 + r() * 0.5, t1 = Math.min(end, t + len), pts: Pt[] = [];
        for (let q = t; q <= t1; q += 0.005) pts.push(at(q, u));
        if (pts.length > 1) body += line(poly(pts), 0.6 + r() * 1.4, 0.35 + r() * 0.55);
        t = t1 + (r() < 0.6 ? 0.005 : 0.02 + r() * 0.08);
      }
    }
  }
  return frame(body, C, C, R0);
}

// ---------- Y 环缘涟漪：圆环边缘若干点各自扩散一组圆，交叠成扇贝纹 ----------
export function styleY(r: R): string {
  const R0 = 125 + r() * 25;
  const n = 5 + Math.floor(r() * 9), even = r() < 0.5, base = r() * TAU;
  const g = 14 + r() * 12, rings = 8 + Math.floor(r() * 8);
  let body = '';
  const pts: Pt[] = Array.from({ length: n }, (_, i) => {
    const a = even ? base + (i / n) * TAU : r() * TAU;
    return [C + (R0 + 2) * Math.cos(a), C + (R0 + 2) * Math.sin(a)];
  });
  for (let j = 0; j < 3 + Math.floor(r() * 4); j++) {
    const [x, y] = pts[Math.floor(r() * n)], i = 2 + Math.floor(r() * (rings - 2));
    const ro = i * g + g * (0.6 + r() * 0.8);
    const outer = polar(x, y, () => ro, 120), inner = polar(x, y, () => i * g, 120);
    body += block(poly(outer, true) + ' ' + poly(inner.reverse(), true), 0.05 + r() * 0.08);
  }
  for (const [x, y] of pts) for (let i = 1; i <= rings; i++) body += circ(x, y, i * g, 0.6 + r() * 1.1, Math.max(0.1, 0.75 - (i / rings) * 0.6));
  return frame(body, C, C, R0);
}
