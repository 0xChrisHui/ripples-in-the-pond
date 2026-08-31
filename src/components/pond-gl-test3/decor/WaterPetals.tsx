'use client';

import { useEffect, useRef } from 'react';
import {
  syncPetals, updatePetals, drawPetals, petalDropScreen, type Petal,
} from './water-petals-sim';
import { acquireWakeField, releaseWakeField } from '../life/wake-field';
import { getRippleTuning } from '../water/spike/ripple-tuning';
import { getSubmerge, getEffectiveWaterLevel } from '../water/water-level';
import { project, type ProjCtx } from '../sphere-projection';
import { depthOf, displayDepthOf, getPointerFx, getCameraFx } from '../pointer-fx';
import { prefersReducedMotion } from '../reduced-motion';
import type { GlSim } from '../spheres/use-gl-sim';
import { getShowcasePose } from '../showcase/showcase-state';
import { sampleP9 } from '../p9/runtime/p9-sampler';
import { applyP9PetalMotion, getP9PetalCount, getP9PetalVisual } from '../p9/consumers/p9-petals';

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
      petals.length = 0; // 清空 → loop 里按当前 W/H + petalCount 重建（尺寸随屏）
    };
    resize();
    window.addEventListener('resize', resize);

    // 涟漪场生命周期（alloc/resize + 指针/涟漪监听喂 drop + 每帧 stepPetalWater）已抽到 life/wake-field
    // （refcount 单例，花瓣层 / 尾波扰球共享一场）→ 本组件挂载时 acquire、卸载时 release。
    acquireWakeField();
    // 球出入水 splash 注入仍属花瓣专属（petalSplash）→ 保留穿越检测；注入走共享 petalDropScreen。
    const prevSub = new Map<string, number>(); // 球出入水穿越检测：每球上帧没入度

    const loop = () => {
      if (cancelled) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const tn = getRippleTuning();
      const p9 = sampleP9(t);
      const nodes = glSimRef.current?.nodes;
      // 球的投影上下文（出入水 splash 注入位置 + 遮挡抠洞 共用）：透视/视差/滚轮/浮动下都贴着视觉球
      const { mx, my } = getPointerFx();
      const c = getCameraFx();
      const proj: ProjCtx = { cx: W / 2, cy: H / 2, mx, my, focusZ: getEffectiveWaterLevel(), dof: c.dof, perspective: c.perspective, parallax: c.parallax };
      // 球出入水：球穿过水面（没入度跨 0.5，滚轮层级 + 每球 _shiftOff，与遮挡同口径 displayDepthOf）→ 在**投影后**球处给花瓣场注入涟漪。
      // 每帧限 5 滴防"滚轮一片球齐穿越"时的水花风暴（同 ripple-feed 限流思路）。
      if (nodes && tn.petalSplash > 0) {
        let splashes = 0;
        for (const n of nodes) {
          if (n.x == null || n.y == null) continue;
          const sub = getSubmerge(displayDepthOf(n));
          const prev = prevSub.get(n.id);
          prevSub.set(n.id, sub);
          if (prev != null && (prev < 0.5) !== (sub < 0.5) && splashes < 5) {
            const pr = project(n.x, n.y, depthOf(n), proj, n);
            petalDropScreen(pr.sx, pr.sy, W, H, 5, 0.6 * tn.petalSplash);
            splashes++;
          }
        }
      }
      const baseCount = Math.max(0, Math.round(tn.petalCount));
      syncPetals(petals, getP9PetalCount(baseCount, p9), W, H, dpr);
      if (!prefersReducedMotion()) updatePetals(petals, dt, t, tn.petalSens);
      applyP9PetalMotion(petals, p9, getShowcasePose());
      ctx.clearRect(0, 0, W, H);
      drawPetals(ctx, petals, t, W, H, dpr, tn.petalSens, tn.petalSize, getP9PetalVisual(p9, petals.length));
      // 遮挡（/test3 投影适配）：出水球在水面之上 → 抠掉花瓣层上**投影后**球身处（destination-out），露出下层 GL 球 = 球盖花瓣。
      // emerged=1−没入：出水球 1（全抠/全盖）、水下球 0（不抠 → 花瓣仍盖其上，正确）；过水线渐变。位置/半径走 project()=视觉球。
      if (nodes) {
        const playingId = glSimRef.current?.playingIdRef.current;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        for (const n of nodes) {
          if (!playingId || n.id !== playingId) continue;
          if (n.x == null || n.y == null) continue;
          const emerged = 1 - getSubmerge(displayDepthOf(n));
          if (emerged <= 0.01) continue;
          const pr = project(n.x, n.y, depthOf(n), proj, n); // 投影后屏幕位置 + 透视缩放
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
      releaseWakeField();
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
