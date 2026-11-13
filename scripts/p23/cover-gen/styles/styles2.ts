// 新封面样图第二批 F–J：螺旋 / 双源干涉 / 雨点涟漪 / 花环 / 唱片纹
import { S, C, TAU, f1, poly, line, block, frame, polar, type Pt } from '../lib';

type R = () => number;
const circ = (cx: number, cy: number, rr: number, w: number, o: number) =>
  `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(rr)}" fill="none" stroke="#fff" stroke-width="${w.toFixed(2)}" stroke-opacity="${o.toFixed(2)}"/>`;
const ring = (cx: number, cy: number, r1: number, r2: number) =>
  poly(polar(cx, cy, () => r2, 120), true) + ' ' + poly(polar(cx, cy, () => r1, 120).reverse(), true);

// ---------- F 螺旋波：从圆环向外旋开的螺旋线，螺距间填色 ----------
export function styleF(r: R): string {
  const R0 = 140 + r() * 30;
  const arms = 1 + Math.floor(r() * 3);
  const gap = 20 + r() * 16;
  const b = (gap * arms) / TAU;
  const dir = r() < 0.5 ? 1 : -1;
  const k = 3 + Math.floor(r() * 6), p = r() * TAU, amp = 2 + r() * 5;
  const rad = (t: number) => R0 * 1.15 + b * t + amp * Math.sin(k * t + p) * Math.min(1, t / 4);
  const arm = (a0: number, t0: number, t1: number, off = 0): Pt[] => {
    const pts: Pt[] = [];
    for (let t = t0; t <= t1; t += 0.02) {
      const q = rad(t) + off;
      const a = dir * t + a0;
      pts.push([C + q * Math.cos(a), C + q * Math.sin(a)]);
    }
    return pts;
  };
  const tMax = (760 - R0 * 1.15) / b;
  let body = '';
  for (let j = 0; j < 4 + Math.floor(r() * 4); j++) {
    const a0 = (Math.floor(r() * arms) / arms) * TAU;
    const t0 = r() * tMax * 0.7, t1 = t0 + 1 + r() * 3;
    body += block(poly([...arm(a0, t0, t1), ...arm(a0, t0, t1, gap * (0.4 + r() * 0.5)).reverse()], true), 0.07 + r() * 0.14);
  }
  for (let i = 0; i < arms; i++) {
    const a0 = (i / arms) * TAU;
    body += line(poly(arm(a0, 0, tMax)), 1.2 + r() * 1.8, 0.75);
    body += line(poly(arm(a0, 0.3, tMax, gap * 0.35)), 0.6 + r() * 0.8, 0.35);
  }
  return frame(body, C, C, R0);
}

// ---------- G 双源干涉：日食与另一处落点各自扩散的环交叠成莫尔纹 ----------
export function styleG(r: R): string {
  const R0 = 140 + r() * 25;
  const a = r() * TAU, d = 300 + r() * 220;
  const sx = C + d * Math.cos(a), sy = C + d * Math.sin(a);
  const g1 = 16 + r() * 10, g2 = 14 + r() * 12;
  let body = '';
  for (let j = 0; j < 3 + Math.floor(r() * 3); j++) {
    const i = Math.floor(r() * 18);
    body += block(ring(sx, sy, 10 + i * g2, 10 + (i + 1) * g2), 0.06 + r() * 0.12);
  }
  for (let j = 0; j < 2 + Math.floor(r() * 2); j++) {
    const i = Math.floor(r() * 14);
    const r1 = R0 * 1.15 + i * g1;
    body += block(ring(C, C, r1, r1 + g1), 0.06 + r() * 0.1);
  }
  for (let i = 0; i < 30; i++) {
    const rr = R0 * 1.15 + i * g1;
    body += circ(C, C, rr, 0.8 + r() * 1.4, Math.max(0.15, 0.85 - i * 0.025));
  }
  for (let i = 0; i < 40; i++) body += circ(sx, sy, 10 + i * g2, 0.6 + r() * 1.2, Math.max(0.12, 0.7 - i * 0.015));
  return frame(body, C, C, R0);
}

// ---------- H 雨点涟漪：圆周围散落若干雨点，各自一组小涟漪 ----------
export function styleH(r: R): string {
  const R0 = 140 + r() * 30;
  let body = '';
  for (let i = 0; i < 5 + Math.floor(r() * 4); i++) {
    const rr = R0 * 1.15 + i * (16 + r() * 12);
    const k = 3 + Math.floor(r() * 5), p = r() * TAU;
    body += line(poly(polar(C, C, (t) => rr + (2 + i) * Math.sin(k * t + p), 240), true), 0.8 + r() * 1.6, 0.8 - i * 0.07);
  }
  const drops = 6 + Math.floor(r() * 6);
  for (let n = 0, tries = 0; n < drops && tries < 200; tries++) {
    const x = 60 + r() * (S - 120), y = 60 + r() * (S - 120);
    if (Math.hypot(x - C, y - C) < R0 * 2.2) continue;
    n++;
    const big = 30 + r() * 110, rings = 3 + Math.floor(r() * 5);
    if (r() < 0.6) body += block(ring(x, y, big * 0.15, big * (0.3 + r() * 0.25)), 0.1 + r() * 0.15);
    for (let i = 1; i <= rings; i++) body += circ(x, y, (big * i) / rings, 0.6 + r() * 1.2, 0.75 - (i / rings) * 0.55);
  }
  return frame(body, C, C, R0);
}

// ---------- I 花环：对称的花瓣曲线层层环绕，部分层填色 ----------
export function styleI(r: R): string {
  const R0 = 140 + r() * 25;
  let body = '';
  let base = R0 * 1.12;
  const layers = 4 + Math.floor(r() * 3);
  for (let l = 0; l < layers; l++) {
    const k = 6 + Math.floor(r() * 12), p = r() * TAU;
    const a = 18 + r() * 34 + l * 6, pw = 0.6 + r() * 1.6;
    const rose = (t: number) => base + a * Math.pow(Math.abs(Math.sin((k * t) / 2 + p)), pw);
    if (r() < 0.4) body += block(poly(polar(C, C, rose, 720), true) + ' ' + poly(polar(C, C, () => base, 240).reverse(), true), 0.04 + r() * 0.06);
    const copies = 2 + Math.floor(r() * 3);
    for (let c = 0; c < copies; c++) {
      body += line(poly(polar(C, C, (t) => rose(t) + c * 7, 720), true), 0.6 + r() * 1.5, 0.8 - l * 0.08 - c * 0.12);
    }
    base += a * 0.45 + 10 + r() * 14;
  }
  return frame(body, C, C, R0);
}

// ---------- J 唱片纹：断续的同心弧段像唱片纹路，部分弧段加粗成色块 ----------
export function styleJ(r: R): string {
  const R0 = 140 + r() * 30;
  const gap = 6 + r() * 7;
  let body = '';
  const arcPts = (rr: number, a0: number, a1: number, wob: number, ph: number): Pt[] => {
    const pts: Pt[] = [];
    for (let a = a0; a <= a1; a += 0.01) {
      const q = rr + wob * Math.sin(a * 7 + ph);
      pts.push([C + q * Math.cos(a), C + q * Math.sin(a)]);
    }
    return pts;
  };
  const wob = r() * 4, ph = r() * TAU;
  for (let j = 0; j < 6 + Math.floor(r() * 6); j++) {
    const rr = R0 * 1.15 + Math.floor(r() * 50) * gap;
    const a0 = r() * TAU, a1 = a0 + 0.3 + r() * 1.6, w = gap * (1 + Math.floor(r() * 3));
    body += block(poly([...arcPts(rr, a0, a1, wob, ph), ...arcPts(rr + w, a0, a1, wob, ph).reverse()], true), 0.08 + r() * 0.17);
  }
  for (let rr = R0 * 1.15; rr < 740; rr += gap * (0.8 + r() * 0.5)) {
    let a = r() * TAU;
    const end = a + TAU;
    while (a < end) {
      const len = 0.2 + r() * 2.2;
      const b = Math.min(end, a + len);
      body += line(poly(arcPts(rr, a, b, wob, ph)), 0.5 + r() * 1.8, 0.25 + r() * 0.6);
      a = b + 0.05 + r() * 0.5;
    }
  }
  return frame(body, C, C, R0);
}
