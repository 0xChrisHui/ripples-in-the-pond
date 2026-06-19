'use client';

import { useEffect, useRef } from 'react';
import {
  NX, allocPetalSim, petalNY, petalDrop, stepPetalWater, syncPetals, updatePetals, drawPetals, type Petal,
} from './water-petals-sim';
import { getRippleTuning } from '../water/spike/ripple-tuning';
import { getSubmerge, getEffectiveWaterLevel } from '../water/water-level';
import { project, type ProjCtx } from '../sphere-projection';
import { renderDepth, getPointerFx, getCameraFx } from '../pointer-fx';
import { prefersReducedMotion } from '../reduced-motion';
import type { GlSim } from '../spheres/use-gl-sim';

/**
 * 水面花瓣层（/test1 WaterPetals 的 fork，复刻 references/flower-water-ripples）：GL 水面之上的 2D overlay canvas。
 * 自跑一个 CPU 涟漪场，喂与 GL 水面同源的事件（指针移动/点击/bg-ripple:wave）→ 花瓣跟同样的波漂、起伏、投影。
 * 数量/大小/灵敏度走参数板（petalCount/petalSize/petalSens），每帧读、即时生效。
 * 遮挡（适配 /test3 投影）：出水球在水面之上 → 用 project() 在花瓣层抠掉**投影后**球身处（destination-out）→ 球盖花瓣；
 *   水下球不抠（花瓣仍盖其上）。出水程度 = 1−getSubmerge(renderDepth)，与扭曲水面遮罩同口径。
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
      // 球的投影上下文（出入水 splash 注入位置 + 遮挡抠洞 共用）：透视/视差/滚轮/浮动下都贴着视觉球
      const { mx, my } = getPointerFx();
      const c = getCameraFx();
      const proj: ProjCtx = { cx: W / 2, cy: H / 2, mx, my, focusZ: getEffectiveWaterLevel(), dof: c.dof, perspective: c.perspective, parallax: c.parallax };
      // 球出入水：球穿过水面（没入度跨 0.5，含球浮动/滚轮层级，与遮挡同口径 renderDepth）→ 在**投影后**球处给花瓣场注入涟漪。
      // 每帧限 5 滴防"滚轮一片球齐穿越"时的水花风暴（同 ripple-feed 限流思路）。
      if (nodes && tn.petalSplash > 0) {
        let splashes = 0;
        for (const n of nodes) {
          if (n.x == null || n.y == null) continue;
          const sub = getSubmerge(renderDepth(n.displayZ ?? n.z, n._waveZ ?? 0));
          const prev = prevSub.get(n.id);
          prevSub.set(n.id, sub);
          if (prev != null && (prev < 0.5) !== (sub < 0.5) && splashes < 5) {
            const pr = project(n.x, n.y, renderDepth(n.z, n._waveZ ?? 0), proj);
            dropScreen(pr.sx, pr.sy, 5, 0.6 * tn.petalSplash);
            splashes++;
          }
        }
      }
      syncPetals(petals, Math.max(0, Math.round(tn.petalCount)), W, H, dpr); // 数量即时增删
      stepPetalWater();
      if (!prefersReducedMotion()) updatePetals(petals, dt, t, tn.petalSens);
      ctx.clearRect(0, 0, W, H);
      drawPetals(ctx, petals, t, W, H, dpr, tn.petalSens, tn.petalSize);
      // 遮挡（/test3 投影适配）：出水球在水面之上 → 抠掉花瓣层上**投影后**球身处（destination-out），露出下层 GL 球 = 球盖花瓣。
      // emerged=1−没入：出水球 1（全抠/全盖）、水下球 0（不抠 → 花瓣仍盖其上，正确）；过水线渐变。位置/半径走 project()=视觉球。
      if (nodes) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        for (const n of nodes) {
          if (n.x == null || n.y == null) continue;
          const emerged = 1 - getSubmerge(renderDepth(n.displayZ ?? n.z, n._waveZ ?? 0));
          if (emerged <= 0.01) continue;
          const pr = project(n.x, n.y, renderDepth(n.z, n._waveZ ?? 0), proj); // 投影后屏幕位置 + 透视缩放
          ctx.globalAlpha = emerged;
          ctx.beginPath();
          ctx.arc(pr.sx, pr.sy, n.radius * pr.scale, 0, Math.PI * 2); // 抠洞 = 视觉球（位置/大小与 GL 球一致）
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
