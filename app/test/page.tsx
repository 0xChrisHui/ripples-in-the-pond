'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Archipelago from '@/src/components/archipelago/Archipelago';
import BackgroundRipples from '@/src/components/BackgroundRipples';
import LoginButton from '@/src/components/auth/LoginButton';
import TestJam from '@/src/components/jam/TestJam';
import DraftSavedToast from '@/src/components/jam/DraftSavedToast';
import SvgAnimationLayer from '@/src/components/animations-svg/SvgAnimationLayer';
import PerfHUD from '@/src/components/PerfHUD';
import EffectsPanel from './EffectsPanel';
import {
  effectsToQuery,
  parseEffectsFromURL,
  type EffectsConfig,
} from '@/src/components/archipelago/effects-config';
import { useResponsiveDefaultEffects } from '@/src/components/archipelago/hooks/use-responsive-effects';
import { useAdaptiveEffects } from '@/src/components/archipelago/hooks/use-adaptive-effects';

function TestPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // v87 — base 跟设备走：手机时 URL 无 query 自动应用 MOBILE_EFFECTS；
  // URL 显式 ?focus=1 等 override 仍然生效。
  const baseEffects = useResponsiveDefaultEffects();
  const [userEffects, setUserEffects] = useState<EffectsConfig>(() =>
    parseEffectsFromURL(searchParams, baseEffects),
  );

  useEffect(() => {
    setUserEffects(parseEffectsFromURL(searchParams, baseEffects));
  }, [searchParams, baseEffects]);

  // L 方案：adaptive 在 user 选择之上叠 force-off。
  // EffectsPanel 仍显示 userEffects（用户意图），Archipelago 接 finalEffects（实际生效）。
  const finalEffects = useAdaptiveEffects(userEffects);

  const handleChange = (next: EffectsConfig) => {
    setUserEffects(next);
    const q = effectsToQuery(next, baseEffects);
    router.replace(q ? `/test?${q}` : '/test');
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      {finalEffects.bgRipples && <BackgroundRipples />}

      <Archipelago fullscreen effects={finalEffects} />

      <SvgAnimationLayer paletteKey="grey" />

      <div className="pointer-events-none fixed left-6 z-30" style={{ top: '14rem' }}>
        <div className="pointer-events-auto"><TestJam /></div>
      </div>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-between px-6 py-5">
        <h1 className={`text-lg font-light tracking-[0.3em] text-white/80${finalEffects.navPond ? ' nav-pond' : ''}`}>
          Ripples in the Pond <span className="text-white/30">— /test sandbox</span>
        </h1>
        <div className="pointer-events-auto"><LoginButton /></div>
      </div>
      {finalEffects.navPond && (
        <div className="nav-pond-glow-line pointer-events-none fixed inset-x-0 top-[60px] z-[60]" />
      )}

      <DraftSavedToast />
      <PerfHUD />
      <EffectsPanel effects={userEffects} onChange={handleChange} />
    </main>
  );
}

export default function TestPage() {
  return (
    <Suspense fallback={null}>
      <TestPageInner />
    </Suspense>
  );
}
