'use client';

import { useEffect, useRef } from 'react';
import {
  NX, allocPetalSim, petalNY, petalDrop, stepPetalWater, syncPetals, updatePetals, drawPetals, type Petal,
} from './water-petals-sim';
import { getRippleTuning } from '../water/spike/ripple-tuning';
import { getSubmerge } from '../water/water-level';
import { prefersReducedMotion } from '../reduced-motion';
import type { GlSim } from '../spheres/use-gl-sim';

/**
 * 水面花瓣层（复刻 references/flower-water-ripples）：GL 水面之上的 2D overlay canvas。
 * 自跑一个 CPU 涟漪场，喂与 GL 水面同源的事件（指针移动/点击/bg-ripple:wave）→ 花瓣跟同样的波漂、起伏、投影。
 * 数量/大小/灵敏度走参数板（petalCount/petalSize/petalSens），每帧读、即时生效。
 * 遮挡：出水球（在水面之上）会挡住花瓣——按出水程度在花瓣层上抠掉球身处（destination-out）；水下球不抠（仍被花瓣盖）。
 * 只在挂载时（flowerPetals 开）跑；卸载即停。pointer-events-none 不挡交互。
 */
export default function WaterPetals({ glSim }: { glSim?: GlSim }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const glSimRef = useRef<GlSim | undefined>(glSim);
  useEffect(() => { glSimRef.current = glSim; }); // 每次 render 同步最新 glSim（切组后 nodes 换新数组）

  useEffect(() => {
    const cv = cvRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, raf = 0, last = performance.now(), cancelled = false;
    const petals: Petal[] = [];

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      allocPetalSim(W, H);
      petals.length = 0; // 清空 → loop 里按当前 W/H + petalCount 重建（尺寸随屏）
    };
    resize();
    window.addEventListener('resize', resize);

    // 喂涟漪场（屏幕坐标 → 网格）：GL 水面同源的"各类波纹"都注入 → 花瓣随波走。
    // 每来源触发强度走参数板倍率（petalDrag/Click/Wave/Splash，1=默认、0=该来源不影响花瓣）。
    const dropScreen = (sx: number, sy: number, radius: number, strength: number) => {
      if (strength <= 0) return;
      petalDrop((sx / Math.max(1, W)) * NX, (sy / Math.max(1, H)) * petalNY(), radius, strength);
    };
    const prevSub = new Map<string, number>(); // 球出入水穿越检测：每球上帧没入度
    let lastMove = 0;
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMove < 28) return; // 节流（同 GL 划水手感）
      lastMove = now;
      dropScreen(e.clientX, e.clientY, 3, 0.16 * getRippleTuning().petalDrag);
    };
    const onDown = (e: PointerEvent) => dropScreen(e.clientX, e.clientY, 5, 0.6 * getRippleTuning().petalClick);
    const onWave = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number }>).detail;
      if (d && typeof d.x === 'number') dropScreen(d.x, d.y, 5, 0.5 * getRippleTuning().petalWave);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('bg-ripple:wave', onWave);

    const loop = () => {
      if (cancelled) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const tn = getRippleTuning();
      const nodes = glSimRef.current?.nodes;
      // 球出入水：球穿过水面（没入度跨 0.5，含球浮动/焦点/水位滚动）→ 在球处给花瓣场注入涟漪。
      // 每帧限 5 滴防"水位滚动一片球齐穿越"时的水花风暴（同 ripple-feed 限流思路）。
      if (nodes && tn.petalSplash > 0) {
        let splashes = 0;
        for (const n of nodes) {
          if (n.x == null || n.y == null) continue;
          const sub = getSubmerge(n.displayZ ?? n.z);
          const prev = prevSub.get(n.id);
          prevSub.set(n.id, sub);
          if (prev != null && (prev < 0.5) !== (sub < 0.5) && splashes < 5) {
            dropScreen(n.x, n.y, 5, 0.6 * tn.petalSplash);
            splashes++;
          }
        }
      }
      syncPetals(petals, Math.max(0, Math.round(tn.petalCount)), W, H, dpr); // 数量即时增删
      stepPetalWater();
      if (!prefersReducedMotion()) updatePetals(petals, dt, t, tn.petalSens);
      ctx.clearRect(0, 0, W, H);
      drawPetals(ctx, petals, t, W, H, dpr, tn.petalSens, tn.petalSize);
      // 遮挡修复：出水球在水面之上 → 抠掉花瓣层上球身处（destination-out），露出下层 GL 球 = 球挡花瓣。
      // emerged=1−没入：出水球 1（全抠/全挡）、水下球 0（不抠 → 花瓣仍盖在其上，正确）；过水线渐变。
      if (nodes) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        for (const n of nodes) {
          if (n.x == null || n.y == null) continue;
          const emerged = 1 - getSubmerge(n.displayZ ?? n.z);
          if (emerged <= 0.01) continue;
          ctx.globalAlpha = emerged;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius * (1 + (n._waveZ ?? 0)), 0, Math.PI * 2); // 球浮动：抠洞随视觉球大小变（与水面遮罩同口径）
          ctx.fill();
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('bg-ripple:wave', onWave);
    };
  }, []);

  return (
    <canvas
      ref={cvRef}
      className="pointer-events-none fixed inset-0 z-10 h-full w-full"
      aria-hidden="true"
    />
  );
}
