'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import LoginButton from '@/src/components/auth/LoginButton';
import TestJam from '@/src/components/jam/TestJam';
import DraftSavedToast from '@/src/components/jam/DraftSavedToast';
import PerfHUD from '@/src/components/PerfHUD';
import { parseGLFlags, isWebGLAvailable, type GLFlags } from '@/src/components/pond-gl-test3/gl-flags';
import { useGlSim } from '@/src/components/pond-gl-test3/spheres/use-gl-sim';
import { usePointerFx, setCameraFx } from '@/src/components/pond-gl-test3/pointer-fx';
import SphereOverlay from '@/src/components/pond-gl-test3/overlay/SphereOverlay';
import GlEclipse from '@/src/components/pond-gl-test3/overlay/GlEclipse';
import GlNav from '@/src/components/pond-gl-test3/overlay/GlNav';
import GlLoading from '@/src/components/pond-gl-test3/overlay/GlLoading';
import TunePanel from '@/src/components/pond-gl-test3/overlay/TunePanel';
import ScenePanel from '@/src/components/pond-gl-test3/overlay/ScenePanel';
import RippleSpikePanel from '@/src/components/pond-gl-test3/water/spike/RippleSpikePanel';

// GL 渲染层：全链路 next/dynamic + ssr:false，three/R3F 只进 /test3 异步 chunk → 首页 bundle 零增量
const PondGL = dynamic(() => import('@/src/components/pond-gl-test3/PondGL'), { ssr: false });

/**
 * /test3 — /test1 的独立 fork（2026-06-18 立项）。
 *
 * 渲染层全部走 `@/src/components/pond-gl-test3/`（/test1 的整树独占副本），后续改 /test3 不动 /test1。
 * 与 /test1 仅有的共享边界：纯数据/配置（archipelago/sphere-config、types/tracks、player/PlayerProvider）。
 * 本文件初始与 /test1 page 逐字一致（仅 import 指向 fork + 标题改 /test3）；后续 task 3/4 在此 fork 上演进。
 */
function Test3PageInner() {
  const searchParams = useSearchParams();
  // GL 层开关（初值取 URL）；背景氛围 fx 随 SVG 卸载移除，到 I3 用 GL 重做再加回
  const [glFlags, setGlFlags] = useState<GLFlags>(() => parseGLFlags(searchParams));
  const onGl = useCallback((patch: Partial<GLFlags>) => setGlFlags((f) => ({ ...f, ...patch })), []);

  // 球 / 水面 / 扭曲水面 任一开 → glSim active（取数 / 建 sim / 订阅涟漪事件）
  const glSim = useGlSim(glFlags.glSpheres || glFlags.water || glFlags.waterFx);
  // J1：WebGL 不可用 / 强制兜底 → GL 走兜底夜塘，对应隐掉 GL 球的 DOM 叠层（命中/日蚀/切组），
  // 免得兜底上浮着一堆没有球的标题（缓存检测，forceFallback 切换时重算）
  const glOk = isWebGLAvailable() && !glFlags.forceFallback;
  // /test3 task 4：水面固定 → 滚轮驱动一点透视缩放 k、鼠标驱动视差（pointer-fx）。仅透视/视差任一开时才挂监听。
  usePointerFx(glFlags.glSpheres && (glFlags.perspective || glFlags.parallax));
  // 相机三效开关（控制台按钮）同步进 pointer-fx 单例 → 各 ctx builder + project 每帧读取门控
  useEffect(() => {
    setCameraFx({ dof: glFlags.dof, perspective: glFlags.perspective, parallax: glFlags.parallax });
  }, [glFlags.dof, glFlags.perspective, glFlags.parallax]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      {/* GL 层：基调 / 球 / 水面 / 背景图 / 实验 任一开就挂 Canvas，都关 = 不加载 three chunk */}
      {(glFlags.glBase || glFlags.glSpheres || glFlags.water || glFlags.bgImage || glFlags.rtt || glFlags.waterFx || glFlags.floatMotes || glFlags.waterPlants || glFlags.reefStones || glFlags.crystalPillars) && (
        <PondGL flags={glFlags} glSim={glSim} />
      )}

      {/* 顶栏：标题 + 登录 */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-between px-6 py-5">
        <h1 className="text-lg font-light tracking-[0.3em] text-white/80">
          Ripples in the Pond <span className="text-white/30">— /test3 GL sandbox</span>
        </h1>
        <div className="pointer-events-auto">
          <LoginButton />
        </div>
      </div>

      {/* I1：GL 切组 nav（左上 A/B/C，点击直接切 GL 组）；J1：兜底时隐（无可见球可切） */}
      {glSim.ready && glOk && <GlNav glSim={glSim} />}

      {/* J4：GL 球取数中/失败的加载浮层（WebGL 可用时才有意义；兜底夜塘自带视觉，不叠） */}
      {glFlags.glSpheres && glOk && (glSim.loading || glSim.error) && (
        <GlLoading error={glSim.error} onRetry={glSim.retry} />
      )}

      {/* 左侧 Jam UI（在 nav 下方） */}
      <div className="pointer-events-none fixed left-6 z-30" style={{ top: '14rem' }}>
        <div className="pointer-events-auto">
          <TestJam />
        </div>
      </div>

      {/* GL 球 DOM 命中层（z-10，接点击拖拽，在 nav/HUD 之下）；J1：兜底时隐 */}
      {glFlags.glSpheres && glSim.ready && glOk && (
        <SphereOverlay glSim={glSim} waterOn={glFlags.water || glFlags.waterFx} depthModel={glFlags.depthModel} />
      )}

      {/* I2：GL 日蚀层（z-20，播放球叠日蚀焦点；其他球已隐去）；J1：兜底时隐 */}
      {glFlags.glSpheres && glSim.ready && glOk && <GlEclipse glSim={glSim} />}

      {/* /test3：水面已固定，水位指示无意义 → 不挂 WaterLevelIndicator */}

      {/* 右下角参数板栏：调色 + 波纹/运动 同栏从下往上堆叠（不重叠） */}
      <div className="pointer-events-none fixed bottom-3 right-3 z-50 flex flex-col-reverse items-end gap-2">
        {glFlags.glSpheres && <TunePanel />}
        {(glFlags.rtt || glFlags.waterFx || glFlags.floatMotes || glFlags.waterPlants || glFlags.reefStones || glFlags.crystalPillars) && <RippleSpikePanel />}
      </div>

      {/* 视觉控制台（左下角，逐层开关 GL 层） */}
      <ScenePanel glFlags={glFlags} onGl={onGl} />

      <DraftSavedToast />
      <PerfHUD />
    </main>
  );
}

export default function Test3Page() {
  return (
    <Suspense fallback={null}>
      <Test3PageInner />
    </Suspense>
  );
}
