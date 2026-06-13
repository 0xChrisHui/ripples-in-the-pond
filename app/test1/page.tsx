'use client';

import { Suspense, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import Archipelago from '@/src/components/archipelago/Archipelago';
import BackgroundRipples from '@/src/components/BackgroundRipples';
import LoginButton from '@/src/components/auth/LoginButton';
import TestJam from '@/src/components/jam/TestJam';
import DraftSavedToast from '@/src/components/jam/DraftSavedToast';
import SvgAnimationLayer from '@/src/components/animations-svg/SvgAnimationLayer';
import PerfHUD from '@/src/components/PerfHUD';
import { useResponsiveDefaultEffects } from '@/src/components/archipelago/hooks/use-responsive-effects';
import { useAdaptiveEffects } from '@/src/components/archipelago/hooks/use-adaptive-effects';
import { parseGLFlags, type GLFlags } from '@/src/components/pond-gl/gl-flags';
import { useGlSim } from '@/src/components/pond-gl/spheres/use-gl-sim';
import SphereOverlay from '@/src/components/pond-gl/overlay/SphereOverlay';
import TunePanel from '@/src/components/pond-gl/overlay/TunePanel';
import ScenePanel, { type SceneFx } from '@/src/components/pond-gl/overlay/ScenePanel';

// GL 渲染层：全链路 next/dynamic + ssr:false，three/R3F 只进 /test1 异步 chunk → 首页 bundle 零增量
const PondGL = dynamic(() => import('@/src/components/pond-gl/PondGL'), { ssr: false });

/**
 * /test1 — P8-G GL 渲染层 spike 沙盒页（2026-06-12 立项）
 *
 * G1：与主页 app/page.tsx 同构（同 Archipelago / 同 effects 来源 / 同 PerfHUD）。
 * G2：页面级默认关 1 点透视（perspective=false），URL ?perspective=1 临时开回对比。
 * G3：最底层垫 GL 基调层（PondGL，next/dynamic ssr:false）。
 *     glBase=0 = 卸载 GL 回 G2 现状；artDir=deep|black 切基调两档。
 * G4：glSpheres=1 = 隐 SVG 球组 + GL InstancedMesh 球 + DOM 命中层；=0 回 SVG 球。
 *
 * 同步机制：base 仍走 useResponsiveDefaultEffects 预设，主页后续改动自动跟进。
 * 路线：G4 GL 球 → G5 水面 → G6 水位三态。详见 playbook/phase-8/phase-8-g-gl-water.md。
 */
function Test1PageInner() {
  const searchParams = useSearchParams();
  const baseEffects = useResponsiveDefaultEffects();
  // G2：默认关 1 点透视；URL ?perspective=1 临时开回对比
  const perspectiveOn = searchParams.get('perspective') === '1';

  // G5：视觉控制台 state —— GL 层开关（初值取 URL）+ 背景氛围 override（默认全关 = 纯净夜塘）
  const [glFlags, setGlFlags] = useState<GLFlags>(() => parseGLFlags(searchParams));
  const [fx, setFx] = useState<SceneFx>({ stars: false, aurora: false, fog: false, bgRipples: false, comet: false });
  const onGl = useCallback((patch: Partial<GLFlags>) => setGlFlags((f) => ({ ...f, ...patch })), []);
  const onFx = useCallback((patch: Partial<SceneFx>) => setFx((f) => ({ ...f, ...patch })), []);

  // 背景氛围默认关叠加到 base（页面级 override，不动共享 presets）；adaptiveQuality 只会再关不会开
  const effects = useAdaptiveEffects({ ...baseEffects, ...fx, perspective: perspectiveOn });
  // 球或水面开启时 glSim active（取数 / 建 sim / 订阅涟漪事件）
  const glSim = useGlSim(glFlags.glSpheres || glFlags.water);

  return (
    <main data-gl-spheres={glFlags.glSpheres ? '1' : '0'} className="relative min-h-screen overflow-hidden bg-black">
      {/* G4 / P0：glSpheres=1 时 SVG sim 层【整层退场】——隐整个 SphereCanvas 的 svg（球+连接线+彗星，
          带稳定 .cursor-grab class）+ portal-to-body 的日食层（data-eclipse-layer）。GL 成唯一渲染，
          消除"两套 sim"错位。style 仅 /test1 挂载期间存在 → 不碰 globals.css、不影响 / 与 /test。
          注：SVG sim 的 d3 tick 仍在跑（display:none 不卸载），故帧率对照时 SVG 仍占少量 CPU，
          GL 单独跑会更高——P2 让 GL 完全接管后再卸载 SVG。 */}
      {glFlags.glSpheres && (
        <style>{`main[data-gl-spheres="1"] svg.cursor-grab{display:none!important}[data-eclipse-layer]{display:none!important}`}</style>
      )}

      {/* GL 层：基调 / 球 / 水面 / 背景图 任一开启就挂 Canvas，都关 = 不加载 three chunk */}
      {(glFlags.glBase || glFlags.glSpheres || glFlags.water || glFlags.bgImage) && <PondGL flags={glFlags} glSim={glSim} />}

      {effects.bgRipples && <BackgroundRipples />}

      <Archipelago fullscreen effects={effects} />

      <SvgAnimationLayer paletteKey="grey" />

      {/* 左侧 Jam UI（在 Archipelago tabs 下方，top-24 + 3 tabs ≈ top-[200px]）*/}
      <div className="pointer-events-none fixed left-6 z-30" style={{ top: '14rem' }}>
        <div className="pointer-events-auto">
          <TestJam />
        </div>
      </div>

      {/* 顶栏：标题 + 登录（navPond 仅接 --pond-* token，默认零变化，不碰布局/字体/登录） */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-between px-6 py-5">
        <h1 className={`text-lg font-light tracking-[0.3em] text-white/80${effects.navPond ? ' nav-pond' : ''}`}>
          Ripples in the Pond <span className="text-white/30">— /test1 GL sandbox</span>
        </h1>
        <div className="pointer-events-auto">
          <LoginButton />
        </div>
      </div>
      {effects.navPond && (
        <div className="nav-pond-glow-line pointer-events-none fixed inset-x-0 top-[60px] z-[60]" />
      )}

      {/* G4：GL 球 DOM 命中层（z-10，盖在 SVG/GL 之上接点击拖拽，在 nav/HUD 之下） */}
      {glFlags.glSpheres && glSim.ready && <SphereOverlay glSim={glSim} />}

      {/* G4：GL 球实时调色面板（右下角，亮度/对比度/饱和度/光晕/浓度 + 保存到 localStorage） */}
      {glFlags.glSpheres && <TunePanel />}

      {/* G5：视觉控制台（左下角，逐层开关 GL 层 + 背景氛围，默认纯净夜塘） */}
      <ScenePanel glFlags={glFlags} onGl={onGl} fx={fx} onFx={onFx} />

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
