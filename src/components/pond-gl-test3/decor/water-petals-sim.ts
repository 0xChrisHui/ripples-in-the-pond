'use client';
export const NX = 160;
let NY = 160;
let u = new Float32Array(NX * NY);
let uPrev = new Float32Array(NX * NY);
const hashVisual = (value: number): number => Math.abs(Math.sin(value * 73.17) * 43758.5453) % 1;

export function allocPetalSim(w: number, h: number): void {
  NY = Math.max(90, Math.min(288, Math.round((NX * h) / Math.max(1, w))));
  u = new Float32Array(NX * NY);
  uPrev = new Float32Array(NX * NY);
}
export function petalNY(): number { return NY; }

export function petalDrop(gx: number, gy: number, radius: number, strength: number): void {
  const r2 = radius * radius;
  const x0 = Math.max(1, Math.floor(gx - radius)), x1 = Math.min(NX - 2, Math.ceil(gx + radius));
  const y0 = Math.max(1, Math.floor(gy - radius)), y1 = Math.min(NY - 2, Math.ceil(gy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - gx, dy = y - gy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) {
        const k = Math.cos((Math.sqrt(d2) / radius) * Math.PI * 0.5);
        u[y * NX + x] += strength * k * k;
      }
    }
  }
}

export function petalDropScreen(sx: number, sy: number, w: number, h: number, radius: number, strength: number): void {
  if (strength <= 0) return;
  petalDrop((sx / Math.max(1, w)) * NX, (sy / Math.max(1, h)) * petalNY(), radius, strength);
}

export function stepPetalWater(): void {
  const damp = 0.979;
  for (let y = 1; y < NY - 1; y++) {
    const row = y * NX;
    for (let x = 1; x < NX - 1; x++) {
      const i = row + x;
      const v = (u[i - 1] + u[i + 1] + u[i - NX] + u[i + NX]) * 0.5 - uPrev[i];
      uPrev[i] = v * damp;
    }
  }
  const t = u; u = uPrev; uPrev = t;
}

export function petalGradAt(gx: number, gy: number): [number, number, number] {
  const x = Math.max(1, Math.min(NX - 2, gx | 0));
  const y = Math.max(1, Math.min(NY - 2, gy | 0));
  const i = y * NX + x;
  return [u[i + 1] - u[i - 1], u[i + NX] - u[i - NX], u[i]];
}

interface Pal { petal: string; edge: string; deep: string }
const PALETTES: Pal[] = [
  { petal: '#bce8de', edge: '#e6f8f2', deep: '#9fd8cb' },
  { petal: '#def0e2', edge: '#f4faf1', deep: '#c2e4cc' },
  { petal: '#f6cfde', edge: '#fde9f0', deep: '#eeb3ca' },
  { petal: '#f8dce6', edge: '#fdf0f5', deep: '#f0c2d2' },
];

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePetalSprite(px: number, pal: Pal, seed: number): HTMLCanvasElement {
  const R = mulberry32(seed);
  const S = Math.ceil(px * 2.6);
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  if (!c) return cv;
  c.translate(S / 2, S / 2);
  c.rotate(R() * Math.PI * 2);
  c.globalAlpha = 0.85;
  const g = c.createLinearGradient(-px * 0.5, 0, px, 0);
  g.addColorStop(0, pal.edge); g.addColorStop(0.45, pal.petal); g.addColorStop(1, pal.edge);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-px * 0.5, 0);
  c.bezierCurveTo(-px * 0.2, -px * 0.5, px * 0.66, -px * 0.44, px, -px * 0.06);
  c.quadraticCurveTo(px * 0.92, 0, px, px * 0.06); // 樱花瓣顶端缺口
  c.bezierCurveTo(px * 0.66, px * 0.44, -px * 0.2, px * 0.5, -px * 0.5, 0);
  c.fill();
  c.globalAlpha = 0.4; c.strokeStyle = pal.deep; c.lineWidth = Math.max(0.5, px * 0.02);
  c.beginPath(); c.moveTo(-px * 0.3, 0); c.quadraticCurveTo(px * 0.3, -px * 0.06, px * 0.85, 0); c.stroke();
  c.globalAlpha = 0.7; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = Math.max(0.6, px * 0.025);
  c.beginPath(); c.moveTo(-px * 0.5, 0); c.bezierCurveTo(-px * 0.2, -px * 0.5, px * 0.66, -px * 0.44, px, -px * 0.06); c.stroke();
  return cv;
}

export interface Petal {
  nx: number; ny: number; vx: number; vy: number;
  rot: number; vr: number; phase: number; px: number; sprite: HTMLCanvasElement;
  lifeAlpha?: number; lifeScale?: number;
}

export interface PetalVisualCue {
  mode: string;
  energy: number;
  progress: number;
  selected: number;
  count: number;
  value: number;
  lineWidth: number;
  seed: number;
  fadeIn: number; fadeOut: number;
}
export interface PetalVisualFx { cues: readonly PetalVisualCue[] }

export function makePetal(i: number, w: number, h: number, dpr: number): Petal {
  const R = mulberry32(11 + i * 13);
  const px = (0.024 + R() * 0.022) * Math.min(w, h); // 基准大小（绘制时再 ×petalSize）
  return {
    nx: 0.08 + ((i * 0.41 + R() * 0.3) % 0.84),
    ny: 0.1 + ((i * 0.59 + R() * 0.3) % 0.8),
    vx: 0, vy: 0, rot: R() * Math.PI * 2, vr: (R() - 0.5) * 0.0022, phase: R() * Math.PI * 2,
    px, sprite: makePetalSprite(px * dpr, PALETTES[(R() * PALETTES.length) | 0], 11 + i * 7),
  };
}

export function syncPetals(petals: Petal[], count: number, w: number, h: number, dpr: number): void {
  while (petals.length < count) petals.push(makePetal(petals.length, w, h, dpr));
  if (petals.length > count) petals.length = count;
}

export function updatePetals(petals: Petal[], dt: number, t: number, sens: number): void {
  for (const p of petals) {
    const [dx, dy] = petalGradAt(p.nx * NX, p.ny * NY);
    p.vx += dx * 0.0017 * sens; p.vy += dy * 0.0017 * sens;
    p.vx += Math.sin(t * 0.18 + p.phase) * 0.0000065 * sens;
    p.vy += Math.cos(t * 0.14 + p.phase * 1.7) * 0.0000065 * sens;
    const pad = 0.05;
    if (p.nx < pad) p.vx += (pad - p.nx) * 0.0007;
    if (p.nx > 1 - pad) p.vx -= (p.nx - (1 - pad)) * 0.0007;
    if (p.ny < pad) p.vy += (pad - p.ny) * 0.0007;
    if (p.ny > 1 - pad) p.vy -= (p.ny - (1 - pad)) * 0.0007;
    p.vx *= 0.984; p.vy *= 0.984;
    p.nx += p.vx * dt * 60; p.ny += p.vy * dt * 60;
    p.rot += (p.vr + dx * 0.012) * sens;
  }
}

export function drawPetals(
  ctx: CanvasRenderingContext2D, petals: Petal[], t: number, w: number, h: number, dpr: number, sens: number, sizeMul: number,
  fx?: PetalVisualFx,
): void {
  for (const stitch of fx?.cues.filter((cue) => cue.mode === 'petal-stitch') ?? []) {
    const a = petals[stitch.selected % petals.length], b = petals[(stitch.selected + 3) % petals.length];
    if (!a || !b) continue;
    const bend = Math.sin(t * 2.1 + stitch.seed) * 18 * stitch.energy;
    ctx.save(); ctx.globalAlpha = Math.sin(stitch.progress * Math.PI) * stitch.energy;
    ctx.strokeStyle = '#e7eee9'; ctx.lineWidth = stitch.lineWidth;
    ctx.beginPath(); ctx.moveTo(a.nx * w, a.ny * h);
    ctx.quadraticCurveTo((a.nx + b.nx) * w / 2 + bend, (a.ny + b.ny) * h / 2 - bend, b.nx * w, b.ny * h);
    ctx.stroke(); ctx.restore();
  }
  for (const [index, p] of petals.entries()) {
    const gh = petalGradAt(p.nx * NX, p.ny * NY)[2];
    const px = p.px * sizeMul;
    const x = p.nx * w;
    const y = p.ny * h + gh * 3 * sens;
    const sc = (1 + gh * 0.15 * sens) * sizeMul * (p.lifeScale ?? 1);
    const sw = p.sprite.width / dpr;
    const cues = fx?.cues.filter((cue) => cue.mode === 'petal-multiply' ? index >= cue.selected : Array.from({ length: cue.count }, (_, at) => (cue.selected + at * 3) % petals.length).includes(index)) ?? [];
    const multiply = cues.find((cue) => cue.mode === 'petal-multiply'); let visualAlpha = p.lifeAlpha ?? 1;
    if (multiply) {
      const delay = ((index * 17 + multiply.seed) % 23) / 100, dwell = multiply.lineWidth + hashVisual(index + multiply.seed) * (multiply.value - multiply.lineWidth);
      const fadeIn = Math.max(0.03, multiply.fadeIn), fadeOut = Math.max(0.05, multiply.fadeOut);
      const outAt = Math.min(0.96 - fadeOut, delay + fadeIn + dwell / 10);
      const multiplyAlpha = multiply.progress < delay ? 0 : multiply.progress < delay + fadeIn ? (multiply.progress - delay) / fadeIn : multiply.progress > outAt ? 1 - (multiply.progress - outAt) / fadeOut : 1;
      visualAlpha *= Math.max(0, Math.min(1, multiplyAlpha));
    }
    ctx.save(); // 沉影
    ctx.translate(x + px * 0.16, y + px * 0.26);
    ctx.rotate(p.rot);
    ctx.globalAlpha = 0.22 * visualAlpha;
    ctx.fillStyle = 'rgba(95,125,155,0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 0, px * 0.8, px * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save(); // 花瓣
    ctx.translate(x, y);
    ctx.rotate(p.rot + Math.sin(t * 1.1 + p.phase) * 0.04 * sens);
    ctx.globalAlpha = visualAlpha;
    const stretchFx = cues.find((cue) => cue.mode === 'petal-stretch');
    if (stretchFx && stretchFx.progress > 0.34) {
      const split = Math.min(1, (stretchFx.progress - 0.34) / 0.4);
      const span = Math.max(w, h) * split * stretchFx.value;
      const gap = span * split * 0.12;
      ctx.globalAlpha = Math.max(0, 1 - split) * stretchFx.energy;
      ctx.strokeStyle = '#edfdf7'; ctx.lineWidth = stretchFx.lineWidth;
      ctx.beginPath(); ctx.moveTo(-gap, 0); ctx.lineTo(-span, 0); ctx.moveTo(gap, 0); ctx.lineTo(span, 0); ctx.stroke();
      ctx.restore(); continue;
    }
    const stretch = stretchFx ? Math.min(1, stretchFx.progress / 0.34) * stretchFx.energy : 0;
    ctx.scale(sc * (1 + stretch * 2.6), sc * (1 - stretch * 0.45));
    const transform = cues.find((cue) => cue.mode === 'petal-transform');
    if (transform) ctx.filter = `grayscale(${transform.progress}) brightness(${1 + transform.energy})`;
    const ingest = cues.find((cue) => cue.mode === 'petal-ingest');
    if (ingest) ctx.globalAlpha *= Math.max(0, 1 - ingest.progress * 1.25);
    ctx.drawImage(p.sprite, -sw / 2, -sw / 2, sw, sw);
    ctx.restore();
  }
}
