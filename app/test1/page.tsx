'use client';

import { Suspense, useMemo } from 'react';
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
import { parseGLFlags } from '@/src/components/pond-gl/gl-flags';

// GL 渲染层：全链路 next/dynamic + ssr:false，three/R3F 只进 /test1 异步 chunk → 首页 bundle 零增量
const PondGL = dynamic(() => import('@/src/components/pond-gl/PondGL'), { ssr: false });

/**
 * /test1 — P8-G GL 渲染层 spike 沙盒页（2026-06-12 立项）
 *
 * G1：与主页 app/page.tsx 同构（同 Archipelago / 同 effects 来源 / 同 PerfHUD）。
 * G2：页面级默认关 1 点透视（perspective=false），URL ?perspective=1 临时开回对比。
 * G3：最底层垫 GL 基调层（PondGL，next/dynamic ssr:false）。
 *     glBase=0 = 卸载 GL 回 G2 现状；artDir=deep|black 切基调两档。
 *
 * 同步机制：base 仍走 useResponsiveDefaultEffects 预设，主页后续改动自动跟进。
 * 路线：G4 GL 球 → G5 水面 → G6 水位三态。详见 playbook/phase-8/phase-8-g-gl-water.md。
 */
function Test1PageInner() {
  const searchParams = useSearchParams();
  const baseEffects = useResponsiveDefaultEffects();
  // G2：默认关 1 点透视；URL ?perspective=1 临时开回对比
  const perspectiveOn = searchParams.get('perspective') === '1';
  // L 方案：adaptiveQuality 开启时，FPS 持续低会自动关掉性能贵的 effect
  const effects = useAdaptiveEffects({ ...baseEffects, perspective: perspectiveOn });
  // G3：G 线沙盒开关（独立文件，不碰共享 effects-config）
  const glFlags = useMemo(() => parseGLFlags(searchParams), [searchParams]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      {/* GL 基调层：垫最底层（z-0），glBase=0 时不挂载（不加载 three chunk）= 回 G2 现状 */}
      {glFlags.glBase && <PondGL flags={glFlags} />}

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
