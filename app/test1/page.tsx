'use client';

import { Suspense, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import LoginButton from '@/src/components/auth/LoginButton';
import TestJam from '@/src/components/jam/TestJam';
import DraftSavedToast from '@/src/components/jam/DraftSavedToast';
import PerfHUD from '@/src/components/PerfHUD';
import { parseGLFlags, type GLFlags } from '@/src/components/pond-gl/gl-flags';
import { useGlSim } from '@/src/components/pond-gl/spheres/use-gl-sim';
import { useWaterLevelControl } from '@/src/components/pond-gl/water/water-level';
import SphereOverlay from '@/src/components/pond-gl/overlay/SphereOverlay';
import GlNav from '@/src/components/pond-gl/overlay/GlNav';
import WaterLevelIndicator from '@/src/components/pond-gl/overlay/WaterLevelIndicator';
import TunePanel from '@/src/components/pond-gl/overlay/TunePanel';
import ScenePanel from '@/src/components/pond-gl/overlay/ScenePanel';
import RippleSpikePanel from '@/src/components/pond-gl/water/spike/RippleSpikePanel';

// GL 渲染层：全链路 next/dynamic + ssr:false，three/R3F 只进 /test1 异步 chunk → 首页 bundle 零增量
const PondGL = dynamic(() => import('@/src/components/pond-gl/PondGL'), { ssr: false });

/**
 * /test1 — P8-G GL 渲染层沙盒页（2026-06-12 立项）
 *
 * I1（2026-06-15）：从"克隆首页 + GL 叠加"改为**干净 GL 页**——卸载 Archipelago/SVG 球系统
 * （连同 d3 sim、SVG 氛围层 AmbientLayers、SvgAnimationLayer、BackgroundRipples 一并去掉），
 * GL 成唯一渲染。切组改用 GL 自己的小 nav（GlNav，A/B/C）+ 键盘 ←→，不再借 Archipelago 的 nav。
 * 红线：只在 /test1 卸载，**不删共享 SVG 代码**（Archipelago/SphereCanvas 仍服务 `/` 与 `/test`）。
 * 历史：G3 GL 基调 → G4 GL 球 + DOM 命中层 → G5 水面 → G6 水位 → H 线水面子系统 → I 线去 SVG。
 */
function Test1PageInner() {
  const searchParams = useSearchParams();
  // GL 层开关（初值取 URL）；背景氛围 fx 随 SVG 卸载移除，到 I3 用 GL 重做再加回
  const [glFlags, setGlFlags] = useState<GLFlags>(() => parseGLFlags(searchParams));
  const onGl = useCallback((patch: Partial<GLFlags>) => setGlFlags((f) => ({ ...f, ...patch })), []);

  // 球 / 水面 / 扭曲水面 任一开 → glSim active（取数 / 建 sim / 订阅涟漪事件）
  const glSim = useGlSim(glFlags.glSpheres || glFlags.water || glFlags.waterFx);
  // 水面或扭曲水面开 + wheelMode=waterLevel → 滚轮驱动水位升降（带缓动）；否则不挂
  useWaterLevelControl((glFlags.water || glFlags.waterFx) && glFlags.wheelMode === 'waterLevel');

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      {/* GL 层：基调 / 球 / 水面 / 背景图 / 实验 任一开就挂 Canvas，都关 = 不加载 three chunk */}
      {(glFlags.glBase || glFlags.glSpheres || glFlags.water || glFlags.bgImage || glFlags.rtt || glFlags.waterFx) && (
        <PondGL flags={glFlags} glSim={glSim} />
      )}

      {/* 顶栏：标题 + 登录 */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-between px-6 py-5">
        <h1 className="text-lg font-light tracking-[0.3em] text-white/80">
          Ripples in the Pond <span className="text-white/30">— /test1 GL sandbox</span>
        </h1>
        <div className="pointer-events-auto">
          <LoginButton />
        </div>
      </div>

      {/* I1：GL 切组 nav（左上 A/B/C，点击直接切 GL 组） */}
      {glSim.ready && <GlNav glSim={glSim} />}

      {/* 左侧 Jam UI（在 nav 下方） */}
      <div className="pointer-events-none fixed left-6 z-30" style={{ top: '14rem' }}>
        <div className="pointer-events-auto">
          <TestJam />
        </div>
      </div>

      {/* GL 球 DOM 命中层（z-10，接点击拖拽，在 nav/HUD 之下） */}
      {glFlags.glSpheres && glSim.ready && (
        <SphereOverlay glSim={glSim} waterOn={glFlags.water || glFlags.waterFx} />
      )}

      {/* 左缘水位指示（水面或扭曲水面开时显示，滚轮淡入） */}
      {(glFlags.water || glFlags.waterFx) && <WaterLevelIndicator />}

      {/* 右下角参数板栏：调色 + 波纹/运动 同栏从下往上堆叠（不重叠） */}
      <div className="pointer-events-none fixed bottom-3 right-3 z-50 flex flex-col-reverse items-end gap-2">
        {glFlags.glSpheres && <TunePanel />}
        {(glFlags.rtt || glFlags.waterFx) && <RippleSpikePanel />}
      </div>

      {/* 视觉控制台（左下角，逐层开关 GL 层） */}
      <ScenePanel glFlags={glFlags} onGl={onGl} />

      <DraftSavedToast />
      <PerfHUD />
    </main>
  );
}

export default function Test1Page() {
  return (
    <Suspense fallback={null}>
      <Test1PageInner />
    </Suspense>
  );
}
