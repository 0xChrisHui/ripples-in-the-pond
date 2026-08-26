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
 * `/v1` — 旧 SVG 首页的稳定存档入口。
 *
 * effects 来自 useResponsiveDefaultEffects()：桌面 10 个全开，
 * 手机（≤767px）仅保留 comet / stars / aurora / bgRipples 4 个氛围 effect。
 * 配置 source of truth 在 src/components/archipelago/effects-config.ts。
 */
export default function V1Page() {
  const baseEffects = useResponsiveDefaultEffects();
  const effects = useAdaptiveEffects(baseEffects);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      {effects.bgRipples && <BackgroundRipples />}

      <Archipelago fullscreen effects={effects} />
      <SvgAnimationLayer paletteKey="grey" />

      <div className="pointer-events-none fixed left-6 z-30" style={{ top: '14rem' }}>
        <div className="pointer-events-auto">
          <TestJam />
        </div>
      </div>

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
