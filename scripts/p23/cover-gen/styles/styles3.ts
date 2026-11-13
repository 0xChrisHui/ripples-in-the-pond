// 新封面样图第三批 K–O：墨流 / 日珥环 / 引力网格 / 点阵波纹 / 剪纸波层
import { S, C, TAU, f1, poly, line, block, frame, polar, type Pt } from '../lib';

type R = () => number;

// ---------- K 墨流：随机流场里的细线绕圆流动，少量宽笔触作色块 ----------
export function styleK(r: R): string {
  const R0 = 140 + r() * 30;
  const terms = Array.from({ length: 4 }, () => ({
    ax: (r() - 0.5) * 0.012, ay: (r() - 0.5) * 0.012, p: r() * TAU, w: 0.5 + r(),
  }));
  const base = r() * TAU;
  const angle = (x: number, y: number) => {
    let v = base;
    for (const t of terms) v += t.w * Math.sin(x * t.ax * 1.0 + y * t.ay + t.p);
    const dx = x - C, dy = y - C, d = Math.hypot(dx, dy);
    const near = Math.max(0, 1 - (d - R0) / (R0 * 1.2));
    const tang = Math.atan2(dy, dx) + Math.PI / 2;
    return v * (1 - near) + tang * near;
  };
  const trace = (x0: number, y0: number): Pt[] => {
    const pts: Pt[] = [];
    for (const dir of [1, -1]) {
      let x = x0, y = y0;
      const seg: Pt[] = [];
      for (let i = 0; i < 160; i++) {
        const a = angle(x, y);
        x += Math.cos(a) * 5 * dir; y += Math.sin(a) * 5 * dir;
        if (x < -20 || y < -20 || x > S + 20 || y > S + 20 || Math.hypot(x - C, y - C) < R0 * 1.08) break;
        seg.push([x, y]);
      }
      if (dir === 1) pts.push(...seg.reverse()); else pts.push([x0, y0], ...seg);
    }
    return pts;
  };
  let body = '';
  const lines: Pt[][] = [];
  const step = 34 + r() * 16;
  for (let y = step / 2; y < S; y += step) for (let x = step / 2; x < S; x += step) {
    const px = x + (r() - 0.5) * step, py = y + (r() - 0.5) * step;
    if (Math.hypot(px - C, py - C) < R0 * 1.1) continue;
    const t = trace(px, py);
    if (t.length > 8) lines.push(t);
  }
  for (let j = 0; j < 4 + Math.floor(r() * 4); j++) {
    const t = lines[Math.floor(r() * lines.length)];
    body += `<path d="${poly(t)}" fill="none" stroke="#fff" stroke-width="${f1(14 + r() * 26)}" stroke-opacity="${(0.05 + r() * 0.08).toFixed(2)}" stroke-linecap="round"/>`;
  }
  for (const t of lines) body += line(poly(t), 0.5 + r() * 1.4, 0.25 + r() * 0.5);
  return frame(body, C, C, R0);
}

// ---------- L 日珥环：从圆环边缘拱起的多层弧环，外围细波 ----------
export function styleL(r: R): string {
  const R0 = 150 + r() * 25;
  const E = R0 + 2;
  const at = (a: number, d: number): Pt => [C + d * Math.cos(a), C + d * Math.sin(a)];
  let body = '';
  for (let i = 0; i < 3 + Math.floor(r() * 3); i++) {
    const rr = R0 * 2 + i * (24 + r() * 26), k = 5 + Math.floor(r() * 12), p = r() * TAU, a = 2 + r() * 6;
    body += line(poly(polar(C, C, (t) => rr + a * Math.sin(k * t + p), 360), true), 0.6 + r() * 1, 0.2 + r() * 0.3);
  }
  const loops = 5 + Math.floor(r() * 5);
  for (let n = 0; n < loops; n++) {
    const th = r() * TAU, w = 0.12 + r() * 0.3, h = R0 * (0.35 + r() * 0.9), lean = (r() - 0.5) * 0.5;
    const nest = 3 + Math.floor(r() * 4);
    for (let s = nest; s >= 1; s--) {
      const f = s / nest;
      const p0 = at(th - w * f, E), p3 = at(th + w * f, E);
      const p1 = at(th - w * f * 0.7 + lean, E + h * f * 1.25), p2 = at(th + w * f * 0.7 + lean, E + h * f * 1.25);
      const d = `M${f1(p0[0])} ${f1(p0[1])} C${f1(p1[0])} ${f1(p1[1])} ${f1(p2[0])} ${f1(p2[1])} ${f1(p3[0])} ${f1(p3[1])}`;
      if (s === nest && r() < 0.7) body += block(d + ' Z', 0.08 + r() * 0.12);
      body += line(d, 0.7 + r() * 1.6, 0.4 + f * 0.45);
    }
  }
  return frame(body, C, C, R0);
}

// ---------- M 引力网格：方格被日食“压弯”，靠近圆处向外推开，少量格子填色 ----------
export function styleM(r: R): string {
  const R0 = 140 + r() * 25;
  const L = R0 * 1.12;
  const g = 38 + r() * 26, rot = r() * Math.PI / 2;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  // r' = √(r² + L²)：圆心被推到圆环外，远处趋于不变，单调不折叠
  const warp = (u: number, v: number): Pt => {
    const x = u * cr - v * sr, y = u * sr + v * cr;
    const d = Math.hypot(x, y) || 1e-6, nd = Math.sqrt(d * d + L * L);
    return [C + (x / d) * nd, C + (y / d) * nd];
  };
  const span = 900;
  let body = '';
  for (let j = 0; j < 5 + Math.floor(r() * 6); j++) {
    const i0 = Math.floor((r() - 0.5) * 14), j0 = Math.floor((r() - 0.5) * 14);
    const u0 = (i0 + 0.5) * g, v0 = (j0 + 0.5) * g, pts: Pt[] = [];
    for (let s = 0; s <= 10; s++) pts.push(warp(u0 + (s / 10) * g, v0));
    for (let s = 0; s <= 10; s++) pts.push(warp(u0 + g, v0 + (s / 10) * g));
    for (let s = 10; s >= 0; s--) pts.push(warp(u0 + (s / 10) * g, v0 + g));
    for (let s = 10; s >= 0; s--) pts.push(warp(u0, v0 + (s / 10) * g));
    body += block(poly(pts, true), 0.08 + r() * 0.16);
  }
  for (let k = -Math.ceil(span / g); k <= Math.ceil(span / g); k++) {
    const c0 = (k + 0.5) * g;
    for (const horiz of [true, false]) {
      const pts: Pt[] = [];
      for (let t = -span; t <= span; t += 6) pts.push(horiz ? warp(t, c0) : warp(c0, t));
      body += line(poly(pts), 0.6 + r() * 1.2, 0.25 + Math.max(0, 0.55 - Math.abs(c0) / 900));
    }
  }
  return frame(body, C, C, R0);
}

// ---------- N 点阵波纹：半调网点随涟漪起伏变大变小，波峰处细线 ----------
export function styleN(r: R): string {
  const R0 = 140 + r() * 25;
  const sp = 15 + r() * 7, f = 0.035 + r() * 0.03, ph = r() * TAU;
  const k = 3 + Math.floor(r() * 5), wa = 6 + r() * 14, wp = r() * TAU;
  const wave = (x: number, y: number) => {
    const d = Math.hypot(x - C, y - C), a = Math.atan2(y - C, x - C);
    return 0.5 + 0.5 * Math.sin((d + wa * Math.sin(k * a + wp)) * f - ph);
  };
  let body = '';
  for (let row = 0, y = 0; y < S + sp; row++, y += sp * 0.866) {
    for (let x = (row % 2) * sp / 2; x < S + sp; x += sp) {
      const d = Math.hypot(x - C, y - C);
      if (d < R0 * 1.12) continue;
      const v = Math.pow(wave(x, y), 1.6) * Math.max(0.35, 1 - (d - R0) / 900);
      const rad = v * sp * 0.48;
      if (rad < 0.6) continue;
      body += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(rad)}" fill="#fff" fill-opacity="${(0.35 + v * 0.55).toFixed(2)}"/>`;
    }
  }
  const per = TAU / f;
  for (let i = 0; i < 4; i++) {
    const rr = R0 * 1.15 + ((ph / f) % per) + i * per * (1 + Math.floor(r() * 2));
    body += line(poly(polar(C, C, (t) => rr - wa * Math.sin(k * t + wp), 360), true), 0.6 + r(), 0.3 + r() * 0.3);
  }
  return frame(body, C, C, R0);
}

// ---------- O 剪纸波层：大块半透明波形层层叠向圆心，边缘描细线 ----------
export function styleO(r: R): string {
  const R0 = 130 + r() * 25;
  const layers = 5 + Math.floor(r() * 3);
  const hs = Array.from({ length: 3 }, () => ({ k: 2 + Math.floor(r() * 5), p: r() * TAU }));
  let body = '';
  for (let l = layers - 1; l >= 0; l--) {
    const base = R0 * 1.25 + l * (42 + r() * 22);
    const amp = 14 + l * (6 + r() * 7);
    const sh = r() * TAU;
    const pts = polar(C, C, (t) => base + amp * hs.reduce((s, h, i) => s + Math.sin(h.k * t + h.p + sh * (i + 1) * 0.3), 0) / 2, 360);
    body += block(poly(pts, true), 0.02 + (1 - l / layers) * 0.045);
    body += line(poly(pts, true), 0.8 + r() * 1.6, 0.35 + (1 - l / layers) * 0.45);
  }
  return frame(body, C, C, R0);
}
