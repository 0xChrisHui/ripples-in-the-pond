'use client';

import Archipelago from '@/src/components/archipelago/Archipelago';
import BackgroundRipples from '@/src/components/BackgroundRipples';
import LoginButton from '@/src/components/auth/LoginButton';
import TestJam from '@/src/components/jam/TestJam';
import DraftSavedToast from '@/src/components/jam/DraftSavedToast';
import SvgAnimationLayer from '@/src/components/animations-svg/SvgAnimationLayer';
import PerfHUD from '@/src/components/PerfHUD';
import { useResponsiveDefaultEffects } from '@/src/components/archipelago/hooks/use-responsive-effects';
import { useAdaptiveEffects } from '@/src/components/archipelago/hooks/use-adaptive-effects';

/**
 * 主页 — Phase 6 B2 v87
 *
 * effects 来自 useResponsiveDefaultEffects()：桌面 10 个全开，
 * 手机（≤767px）仅保留 comet / stars / aurora / bgRipples 4 个氛围 effect。
 * 配置 source of truth 在 src/components/archipelago/effects-config.ts。
 *
 * /test sandbox 在同一份 effects-config 上叠 URL query 覆盖，主页和 sandbox
 * 视觉栈完全一致，仅多了右下角 FX 面板 + 标题后缀。
 *
 * z-stack：
 *  z-0    BackgroundRipples（背景随机白涟漪，受 effects.bgRipples 控）+ Archipelago fullscreen 岛屿
 *  z-30   Archipelago tabs（左侧 vertical）+ TestJam UI（左侧 ABC 下方）
 *  z-40   SvgAnimationLayer 按键动画（pointer-events:none）
 *  z-9999 EclipseLayer（Portal 到 body）— 日食最上层
 *  z-60   顶栏（标题 + LoginButton "我的音乐"）
 */
export default function Home() {
  const baseEffects = useResponsiveDefaultEffects();
  // L 方案：adaptiveQuality 开启时，FPS 持续低会自动关掉性能贵的 effect
  const effects = useAdaptiveEffects(baseEffects);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
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
          Ripples in the Pond
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
