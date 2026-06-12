'use client';

/**
 * P8-A S1 — 水扰动场（water field）
 *
 * 监听 window 'bg-ripple:wave' {detail:{x,y,size,duration}}，维护一组「带时间衰减的
 * 扰动源」。每个 SphereNode 用自身 getBoundingClientRect 的屏幕中心采样该场，得到
 * 「当前这颗球受到的水扰动强度 0~1」，再驱动 feDisplacementMap 的 scale。
 *
 * 设计取舍：
 * - 自包含、不依赖 Lane E 的 zMap / SphereCanvas。扰动源是模块级单例（所有球共享一份），
 *   只装一次 window listener，SSR 安全（懒初始化）。
 * - 扰动 = 空间高斯（离涟漪圆心越近越强）× 时间钟形（sin(πt)，涟漪从生到灭强度先升后降）。
 *   钟形而非单调衰减，模拟「涟漪经过球身时把它顶起来又落下」的体感。
 * - 采样按调用方节流（SphereNode 每 ~6 帧调一次），本模块不跑 rAF，零常驻开销。
 */

interface WaveSource {
  x: number;       // 涟漪圆心屏幕坐标
  y: number;
  size: number;    // 涟漪最终半径（px），决定空间影响范围
  spawnTime: number;
  duration: number;
}

const MAX_SOURCES = 24; // 上限，避免点击狂按时无限堆积
let sources: WaveSource[] = [];
let inited = false;

function ensureInit(): void {
  if (inited || typeof window === 'undefined') return;
  inited = true;
  window.addEventListener('bg-ripple:wave', (e: Event) => {
    const ce = e as CustomEvent<{ x: number; y: number; size?: number; duration?: number }>;
    const d = ce.detail;
    if (!d || typeof d.x !== 'number' || typeof d.y !== 'number') return;
    sources.push({
      x: d.x,
      y: d.y,
      size: d.size ?? 180,
      spawnTime: performance.now(),
      duration: d.duration ?? 3200,
    });
    if (sources.length > MAX_SOURCES) sources = sources.slice(-MAX_SOURCES);
  });
}

/**
 * 采样某屏幕点当前的水扰动强度（0~1，可叠加后 clamp）。
 * 顺手剔除已过期的源（惰性 GC，避免常驻 rAF）。
 */
export function sampleWaterField(px: number, py: number): number {
  if (!inited) ensureInit();
  const now = performance.now();
  let alive = false;
  let total = 0;
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const t = (now - s.spawnTime) / s.duration;
    if (t < 0 || t >= 1) continue;
    alive = true;
    // 时间钟形：sin(πt) 0→1→0
    const timeAmp = Math.sin(t * Math.PI);
    // 涟漪当前半径随 t 扩张；离当前波前越近扰动越强（高斯环带）
    const dx = px - s.x;
    const dy = py - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const front = s.size * t;            // 当前波前半径
    const band = s.size * 0.55;          // 影响带宽
    const ring = Math.exp(-((dist - front) * (dist - front)) / (2 * band * band));
    total += timeAmp * ring;
  }
  // 惰性 GC：本帧没有任何存活源时清空数组
  if (!alive && sources.length > 0) sources = [];
  return total > 1 ? 1 : total;
}

/** 给外部（如测试 / 主会话 Wave 2）手动注入扰动源用 */
export function spawnWaterSource(x: number, y: number, size = 180, duration = 3200): void {
  if (!inited) ensureInit();
  sources.push({ x, y, size, spawnTime: performance.now(), duration });
  if (sources.length > MAX_SOURCES) sources = sources.slice(-MAX_SOURCES);
}

/**
 * 共享滤镜驱动（ref-counted 单例 rAF）。
 *
 * waterRipple 是「一份滤镜 #water-ripple 给所有球用」，feDisplacementMap.scale 不能逐球设；
 * 故用全局聚合扰动驱动 scale —— 取所有活跃扰动源「时间钟形峰值」的最大值 × scaleMax。
 * 视觉上读作「水波经过水塘时整片轻微折射」，per-sphere 精度留 Wave 2（需 zMap + 球屏幕坐标）。
 *
 * SphereNode 在 waterRipple=true 时 acquire、卸载/关 flag 时 release；引用归零即停 rAF，
 * 并把 scale 复位 0（关 flag = 像素级回现状）。每 ~5 帧写一次属性（节流）。
 */
let driverRefCount = 0;
let driverRaf = 0;
let driverFrame = 0;
let driverScaleMax = 12;

function writeDispScale(scale: number): void {
  const el = document.querySelector('[data-water-disp]');
  if (el) el.setAttribute('scale', String(scale));
}

function driverLoop(): void {
  if (driverFrame++ % 5 === 0) {
    const now = performance.now();
    let peak = 0;
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      const t = (now - s.spawnTime) / s.duration;
      if (t < 0 || t >= 1) continue;
      const amp = Math.sin(t * Math.PI);
      if (amp > peak) peak = amp;
    }
    writeDispScale(Math.round(peak * driverScaleMax * 10) / 10);
  }
  driverRaf = requestAnimationFrame(driverLoop);
}

export function acquireWaterFilterDriver(scaleMax: number): void {
  if (typeof window === 'undefined') return;
  if (!inited) ensureInit();
  driverScaleMax = scaleMax;
  driverRefCount++;
  if (driverRaf === 0) {
    driverFrame = 0;
    driverRaf = requestAnimationFrame(driverLoop);
  }
}

export function releaseWaterFilterDriver(): void {
  if (driverRefCount > 0) driverRefCount--;
  if (driverRefCount === 0 && driverRaf !== 0) {
    cancelAnimationFrame(driverRaf);
    driverRaf = 0;
    writeDispScale(0); // 复位：关 flag 回现状
  }
}
