'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import Archipelago from '@/src/components/archipelago/Archipelago';
import BackgroundRipples from '@/src/components/BackgroundRipples';
import LoginButton from '@/src/components/auth/LoginButton';
import TestJam from '@/src/components/jam/TestJam';
import DraftSavedToast from '@/src/components/jam/DraftSavedToast';
import SvgAnimationLayer from '@/src/components/animations-svg/SvgAnimationLayer';
import { useResponsiveDefaultEffects } from '@/src/components/archipelago/hooks/use-responsive-effects';
import { useAdaptiveEffects } from '@/src/components/archipelago/hooks/use-adaptive-effects';

const PerfHUD = dynamic(() => import('@/src/components/PerfHUD'));

/** 旧 SVG 水塘本体；保留历史效果，同时给当前产品一个稳定返回出口。 */
export default function V1Experience({ showPerf }: { showPerf: boolean }) {
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

      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-between gap-4 px-4 py-5 sm:px-6">
        <h1 className={`text-sm font-light tracking-[0.24em] text-white/80 sm:text-lg sm:tracking-[0.3em]${effects.navPond ? ' nav-pond' : ''}`}>
          Ripples in the Pond
        </h1>
        <nav className="pointer-events-auto flex items-center gap-3" aria-label="存档页面导航">
          <Link
            className="inline-flex min-h-11 items-center text-xs tracking-[0.08em] text-white/75 underline-offset-4 hover:underline"
            href="/"
          >
            ← 返回当前水塘
          </Link>
          <LoginButton />
        </nav>
      </div>
      {effects.navPond && (
        <div className="nav-pond-glow-line pointer-events-none fixed inset-x-0 top-[60px] z-[60]" />
      )}

      <DraftSavedToast />
      {showPerf && <PerfHUD />}
    </main>
  );
}
