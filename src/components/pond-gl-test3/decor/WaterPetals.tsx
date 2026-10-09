'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { HALO_R } from '../spheres/sphere-shader';
import { BODY_RATIO } from '../spheres/sphere-frame';
import type { Track36VisitorState } from '../visitor/track36-state';
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
import type { ResidentEchoRuntime } from '@/src/types/echo-resident';

/**
 * 音乐圆抠洞渐变 sprite：半径 1 = 光晕外缘（R×HALO_R）。0.80 内（含边缘起伏最小处）全抠＝实体主体不透水纹/花瓣；
 * 0.80→本体边缘 0.862 降到光晕峰值附近，其后随球光晕衰减到 0，让半透明光晕下的花瓣透出来。
 */
function makeBallMask(): HTMLCanvasElement {
  const size = 128, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!, r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  const body = BODY_RATIO;
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.8, 'rgba(0,0,0,1)');
  grad.addColorStop(body, 'rgba(0,0,0,0.4)');
  grad.addColorStop(body + (1 - body) * 0.45, 'rgba(0,0,0,0.12)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/**
 * 水面花瓣层（/test1 WaterPetals 的 fork，复刻 references/flower-water-ripples）：GL 水面之上的 2D overlay canvas。
 * 自跑一个 CPU 涟漪场，喂与 GL 水面同源的事件（指针移动/点击/bg-ripple:wave）→ 花瓣跟同样的波漂、起伏、投影。
 * 数量/大小/灵敏度走参数板（petalCount/petalSize/petalSens），每帧读、即时生效。
 * 遮挡（适配 /test3 投影）：出水球在水面之上 → 用 project() 在花瓣层抠掉**投影后**球身处（destination-out）→ 球盖花瓣；
 *   水下球不抠（花瓣仍盖其上）。出水程度 = 1−getSubmerge(renderDepth)，与扭曲水面遮罩同口径。
 * 只在挂载时（flowerPetals 开）跑；卸载即停。pointer-events-none 不挡交互。
 */
export default function WaterPetals({ glSim, resident, visitor }: {
  glSim?: GlSim; resident?: ResidentEchoRuntime; visitor?: RefObject<Track36VisitorState | null>;
}) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const glSimRef = useRef<GlSim | undefined>(glSim);
  const residentRef = useRef(resident);
  const visitorRef = visitor;
  useEffect(() => { glSimRef.current = glSim; }); // 每次 render 同步最新 glSim（切组后 nodes 换新数组）
  useEffect(() => { residentRef.current = resident; }, [resident]);

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

    let maskSprite: HTMLCanvasElement | undefined;
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
      // 遮挡（/test3 投影适配）：音乐圆圈所在层（displayDepthOf）与水面层（getSubmerge）比较——
      // 圆圈在水面层以上 → 抠掉花瓣层上**投影后**球身处（destination-out），露出下层 GL 球 = 球盖花瓣；
      // 圆圈在水下 → 不抠，花瓣仍盖其上。emerged=1−没入：出水 1、水下 0，过水线渐变。位置/半径走 project()=视觉球。
      // 所有音乐圆圈（含第 36 圆）同口径，不再只限正在播放的那一颗。
      const visitorNode = visitorRef?.current?.node;
      maskSprite ??= makeBallMask();
      if (nodes || visitorNode) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        for (const n of [...(nodes ?? []), ...(visitorNode ? [visitorNode] : [])]) {
          if (n.x == null || n.y == null) continue;
          const emerged = (1 - getSubmerge(displayDepthOf(n))) * (n._visualDim ?? 1);
          if (emerged <= 0.01) continue;
          const pr = project(n.x, n.y, depthOf(n), proj, n); // 投影后屏幕位置 + 透视缩放
          ctx.globalAlpha = emerged;
          if (n === visitorNode) { // 第 36 圆保持原样：实心圆
            ctx.beginPath();
            ctx.arc(pr.sx, pr.sy, n.radius * pr.scale, 0, Math.PI * 2);
            ctx.fill();
            continue;
          }
          // 普通音乐圆：实体主体全抠，外圈光晕按渐变抠（半透明光晕下花瓣仍可见）。sprite 覆盖到光晕外缘 R×HALO_R。
          const size = n.radius * pr.scale * HALO_R * 2;
          ctx.drawImage(maskSprite, pr.sx - size / 2, pr.sy - size / 2, size, size);
        }
        ctx.restore();
      }
      const pose = residentRef.current?.getSnapshot().pose;
      if (pose && pose.effectivePresence > 0 && pose.bodyRadiusPx > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = pose.effectivePresence * (1 - getSubmerge(pose.depth));
        ctx.beginPath(); ctx.arc(pose.sx, pose.sy, pose.bodyRadiusPx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
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
  }, [visitorRef]);

  return (
    <canvas
      ref={cvRef}
      className="pointer-events-none fixed inset-0 z-10 h-full w-full"
      aria-hidden="true"
    />
  );
}
