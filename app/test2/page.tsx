'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useGlSim } from '@/src/components/pond-gl/spheres/use-gl-sim';
import { useWaterLevelControl, nudgeWaterLevel } from '@/src/components/pond-gl/water/water-level';
import SphereOverlay from '@/src/components/pond-gl/overlay/SphereOverlay';
import GlNav from '@/src/components/pond-gl/overlay/GlNav';
import WaterLevelIndicator from '@/src/components/pond-gl/overlay/WaterLevelIndicator';
import TunePanel from '@/src/components/pond-gl/overlay/TunePanel';

// GL 渲染层全链路 next/dynamic + ssr:false：three/R3F 只进 /test2 异步 chunk（与 /test1 同纪律）
const Test2Canvas = dynamic(() => import('./components/Test2Canvas'), { ssr: false });

// 初始水位卡中段：把共享水位 target 拨到 ~0.5（球 z∈[0,1]）→ 约一半球水上、一半水下。
// 复用 water-level 的公开 API nudgeWaterLevel（= 滚轮同款入口，deltaY<0 抬升）；不改任何 /test1 文件。
const HALF_LEVEL_NUDGE = -0.5 / 0.0008; // nudgeWaterLevel(deltaY) 内部 target -= deltaY*0.0008 → target≈0.5

/**
 * /test2 — K7 参考水实验页（2026-06-18，R6）。
 *
 * 纯实验、不入生产：移植 references/flower-water-ripples 的明亮日光水（水照片 + CPU 粗网格涟漪 +
 * 折射/阳光合成）作背景，叠 /test1 同款球系统（useGlSim + SphereInstances + SphereOverlay），
 * 水位卡中段 → 直观感受"球嵌在那种明亮水里"的 50/50 观感，为 K5/K6/K3 提供手感实据。
 * 不碰 /test1 任何文件；新文件全部在 app/test2/ 下。
 */
export default function Test2Page() {
  // 球 sim：取数 / 建 d3 sim / 订阅涟漪事件（与 /test1 完全同源）
  const glSim = useGlSim(true);
  // 滚轮 / 双指捏合控水位（带缓动）——同 /test1 体验
  useWaterLevelControl(true);

  // 挂载即把水位拨到中段（一次性）→ 球 50/50；current 随后由 useWaterLevelControl 的 rAF 缓动逼近
  useEffect(() => {
    nudgeWaterLevel(HALF_LEVEL_NUDGE);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      {/* 参考水背景 + 球（Canvas 内）；ssr:false 异步挂载 */}
      <Test2Canvas glSim={glSim} />

      {/* 顶栏标题（标明实验页身份） */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-between px-6 py-5">
        <h1 className="text-lg font-light tracking-[0.3em] text-white/80">
          Ripples in the Pond <span className="text-white/30">— /test2 reference-water lab</span>
        </h1>
      </div>

      {/* GL 切组 nav（左上 A/B/C）；球就绪后显示 */}
      {glSim.ready && <GlNav glSim={glSim} />}

      {/* 球 DOM 命中层（标题 / 点击播放 / 拖拽）；waterOn=false → 标题不随没入淡出（与球全显示一致） */}
      {glSim.ready && <SphereOverlay glSim={glSim} waterOn={false} />}

      {/* 左缘水位指示（滚轮 / 捏合时淡入） */}
      <WaterLevelIndicator />

      {/* GL 球调色板（亮度/对比/饱和/光晕/浓度；与 /test1 共享 sphere-tuning store） */}
      <div className="pointer-events-none fixed bottom-3 right-3 z-50 flex flex-col items-end gap-2">
        <TunePanel />
      </div>
    </main>
  );
}
