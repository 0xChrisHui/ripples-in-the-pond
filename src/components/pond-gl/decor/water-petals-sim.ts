'use client';

/**
 * 水面花瓣 + 投影 —— 复刻 references/flower-water-ripples 的机制（移植进 GL 沙盒、2D overlay 画）：
 *  ① CPU 涟漪场（粗网格波动方程）：喂与 GL 水面同源的指针/涟漪事件 → 有同样的波；
 *  ② 花瓣沿涟漪场梯度漂 + 随高度起伏/缩放 = "永远跟水面走"；
 *  ③ 程序化樱花瓣 sprite（贝塞尔）+ 沉影椭圆，画在 GL 之上的 2D canvas。
 * 模块级可变状态（场/网格）放这里（避 react-hooks/immutability，且需跨帧；范式同 ripple-feed）。
 */

export const NX = 160;
let NY = 160;
let u = new Float32Array(NX * NY);
let uPrev = new Float32Array(NX * NY);

/** 按画面宽高比重建网格（NY 随之变，端点 clamp） */
export function allocPetalSim(w: number, h: number): void {
  NY = Math.max(90, Math.min(288, Math.round((NX * h) / Math.max(1, w))));
  u = new Float32Array(NX * NY);
  uPrev = new Float32Array(NX * NY);
}
export function petalNY(): number { return NY; }

/** 注入一滴（升余弦凸包）；gx/gy = 网格坐标 */
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

/** 推进一帧波动方程（damp 0.979），ping-pong 交换 */
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

/** [gradX, gradY, height] at 网格 (gx,gy)（花瓣读它漂 + 起伏） */
export function petalGradAt(gx: number, gy: number): [number, number, number] {
  const x = Math.max(1, Math.min(NX - 2, gx | 0));
  const y = Math.max(1, Math.min(NY - 2, gy | 0));
  const i = y * NX + x;
  return [u[i + 1] - u[i - 1], u[i + NX] - u[i - NX], u[i]];
}

/* ===================== 程序化樱花瓣 sprite ===================== */
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

/* ===================== 花瓣对象 + 更新 + 绘制 ===================== */
export interface Petal {
  nx: number; ny: number; vx: number; vy: number;
  rot: number; vr: number; phase: number; px: number; sprite: HTMLCanvasElement;
}

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

/** 把花瓣数组对齐到目标数量（数量滑块改动时增/删；增的现做、删的截断）。 */
export function syncPetals(petals: Petal[], count: number, w: number, h: number, dpr: number): void {
  while (petals.length < count) petals.push(makePetal(petals.length, w, h, dpr));
  if (petals.length > count) petals.length = count;
}

/** 花瓣随涟漪场梯度漂 + 轻柔自漂 + 边缘软回拢（永远跟水面走）。sens=各种运动幅度倍率（边缘回拢/阻尼不缩，保稳定）。 */
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

/** 先画沉影（偏移椭圆）再画花瓣 sprite；随高度起伏 y/缩放 + 轻摇。sens=运动幅度倍率，sizeMul=大小倍率（含投影）。 */
export function drawPetals(
  ctx: CanvasRenderingContext2D, petals: Petal[], t: number, w: number, h: number, dpr: number, sens: number, sizeMul: number,
): void {
  for (const p of petals) {
    const gh = petalGradAt(p.nx * NX, p.ny * NY)[2];
    const px = p.px * sizeMul;
    const x = p.nx * w;
    const y = p.ny * h + gh * 3 * sens;
    const sc = (1 + gh * 0.15 * sens) * sizeMul;
    const sw = p.sprite.width / dpr;
    ctx.save(); // 沉影
    ctx.translate(x + px * 0.16, y + px * 0.26);
    ctx.rotate(p.rot);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = 'rgba(95,125,155,0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 0, px * 0.8, px * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save(); // 花瓣
    ctx.translate(x, y);
    ctx.rotate(p.rot + Math.sin(t * 1.1 + p.phase) * 0.04 * sens);
    ctx.scale(sc, sc);
    ctx.drawImage(p.sprite, -sw / 2, -sw / 2, sw, sw);
    ctx.restore();
  }
}
