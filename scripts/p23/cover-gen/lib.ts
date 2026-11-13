// 新 Score 封面样图公共部分：画框（日食圆）+ 工具函数 + 风格 A/B

export const S = 1000;
export const C = S / 2;
export const TAU = Math.PI * 2;

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const f1 = (v: number) => v.toFixed(1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type Pt = [number, number];
export const poly = (pts: Pt[], close = false) =>
  'M' + pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L') + (close ? ' Z' : '');
export const line = (d: string, w: number, o: number) =>
  `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w.toFixed(2)}" stroke-opacity="${o.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
export const block = (d: string, o: number) =>
  `<path d="${d}" fill="#fff" fill-opacity="${o.toFixed(3)}" fill-rule="evenodd"/>`;

/** 共用：夜塘底 + 日冕光晕 + 黑盘 + 白环（与应用内日食焦点同一套视觉）。 */
export function frame(body: string, cx: number, cy: number, R: number, under = ''): string {
  const H = R * 3.4;
  const k = R / H;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<defs>
  <radialGradient id="bg" cx="50%" cy="50%" r="72%">
    <stop offset="0%" stop-color="#0b1316"/><stop offset="100%" stop-color="#020405"/>
  </radialGradient>
  <radialGradient id="halo" cx="${cx}" cy="${cy}" r="${H}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/>
    <stop offset="${(k * 0.98).toFixed(3)}" stop-color="#fff" stop-opacity="0"/>
    <stop offset="${k.toFixed(3)}" stop-color="#fff" stop-opacity="0.5"/>
    <stop offset="${(k * 1.35).toFixed(3)}" stop-color="#fff" stop-opacity="0.22"/>
    <stop offset="${(k * 2.2).toFixed(3)}" stop-color="#fff" stop-opacity="0.07"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="${S}" height="${S}" fill="url(#bg)"/>
${under}
<circle cx="${cx}" cy="${cy}" r="${H}" fill="url(#halo)"/>
${body}
<circle cx="${cx}" cy="${cy}" r="${R}" fill="#000"/>
<circle cx="${cx}" cy="${cy}" r="${R + 1.5}" fill="none" stroke="#fff" stroke-width="2.6" stroke-opacity="0.92"/>
</svg>`;
}

/** 极坐标闭合曲线。 */
export function polar(cx: number, cy: number, rf: (t: number) => number, n = 360): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    const r = rf(t);
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return pts;
}

// ---------- A 涟漪环：同心的扰动圆环，部分环间填色 ----------
export function styleA(r: () => number): string {
  const R = 150 + r() * 30;
  const n = 15 + Math.floor(r() * 6);
  const harm = Array.from({ length: 4 }, () => ({
    k: 2 + Math.floor(r() * 7), p: r() * TAU, a: 0.3 + r() * 0.7,
  }));
  const rings: Pt[][] = [];
  let rad = R * 1.18;
  for (let i = 0; i < n; i++) {
    const amp = 2 + i * (1.2 + r() * 1.8);
    const shift = r() * TAU;
    rings.push(polar(C, C, (t) =>
      rad + amp * harm.reduce((s, h) => s + h.a * Math.sin(h.k * t + h.p + shift * 0.3 * i / n), 0) / 2));
    rad += 14 + r() * 26;
  }
  let body = '';
  const fills = 3 + Math.floor(r() * 3);
  for (let j = 0; j < fills; j++) {
    const i = Math.floor(r() * (n - 2));
    const w = 1 + Math.floor(r() * 2);
    body += block(poly(rings[i], true) + ' ' + poly(rings[i + w].slice().reverse(), true), 0.06 + r() * 0.14);
  }
  rings.forEach((p, i) => {
    body += line(poly(p, true), 0.8 + r() * 2.6, Math.max(0.15, 0.9 - (i / n) * 0.7 - r() * 0.15));
  });
  return frame(body, C, C, R);
}

// ---------- B 日冕丝：从圆环向外旋出的波状细丝 + 火焰形色块 ----------
export function strand(r: () => number, R: number, th: number, len: number, swirl: number, wig: number, wf: number): Pt[] {
  const pts: Pt[] = [];
  const steps = 40;
  const ph = r() * TAU;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const d = R * 1.06 + len * u;
    const a = th + swirl * u * u + Math.sin(u * wf + ph) * wig * u;
    pts.push([C + d * Math.cos(a), C + d * Math.sin(a)]);
  }
  return pts;
}
export function styleB(r: () => number): string {
  const R = 135 + r() * 30;
  const swirl = (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.9);
  let body = '';
  const petals = 4 + Math.floor(r() * 4);
  for (let j = 0; j < petals; j++) {
    const th = r() * TAU;
    const len = R * (1.2 + r() * 1.6);
    const width = 0.08 + r() * 0.14;
    const a = strand(r, R, th - width / 2, len, swirl, 0.1, 5);
    const b = strand(r, R, th + width / 2, len * (0.85 + r() * 0.2), swirl, 0.1, 5);
    body += block(poly([...a, ...b.reverse()], true), 0.07 + r() * 0.13);
  }
  const m = 70 + Math.floor(r() * 70);
  for (let i = 0; i < m; i++) {
    const th = (i / m) * TAU + r() * 0.05;
    const len = R * (0.4 + Math.pow(r(), 1.6) * 2.4);
    body += line(poly(strand(r, R, th, len, swirl, 0.05 + r() * 0.12, 4 + r() * 8)),
      0.6 + r() * 1.8, 0.25 + r() * 0.6);
  }
  return frame(body, C, C, R);
}

