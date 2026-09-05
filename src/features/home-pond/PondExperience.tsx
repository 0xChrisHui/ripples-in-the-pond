'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import DraftSavedToast from '@/src/components/jam/DraftSavedToast';
import TestJam from '@/src/components/jam/TestJam';
import { parseGLFlags, type GLFlags } from '@/src/components/pond-gl-test3/gl-flags';
import type { GlHealth } from '@/src/components/pond-gl-test3/PondGL';
import GlEclipse from '@/src/components/pond-gl-test3/overlay/GlEclipse';
import GlLoading from '@/src/components/pond-gl-test3/overlay/GlLoading';
import GlNav from '@/src/components/pond-gl-test3/overlay/GlNav';
import PondHeader from '@/src/components/pond-gl-test3/overlay/PondHeader';
import SphereOverlay from '@/src/components/pond-gl-test3/overlay/SphereOverlay';
import { setCameraFx, usePointerFx } from '@/src/components/pond-gl-test3/pointer-fx';
import { loadP9Tuning } from '@/src/components/pond-gl-test3/p9/tuning/p9-tuning-store';
import { useGlSim } from '@/src/components/pond-gl-test3/spheres/use-gl-sim';

const PondGL = dynamic(() => import('@/src/components/pond-gl-test3/PondGL'), { ssr: false });
const SandboxControls = dynamic(() => import('./SandboxControls'), { ssr: false });

type PondMode = 'production' | 'test3' | 'test4';

/** 生产与沙盒共用同一水塘；沙盒控制器保持在独立异步 chunk。 */
export default function PondExperience({ mode }: { mode: PondMode }) {
  const searchParams = useSearchParams();
  const sandbox = mode !== 'production';
  const p9Enabled = mode !== 'test4';
  const [glFlags, setGlFlags] = useState<GLFlags>(() => parseGLFlags(searchParams));
  const [runtimeGlHealth, setRuntimeGlHealth] = useState<GlHealth>('unavailable');
  const onGl = useCallback((patch: Partial<GLFlags>) => {
    setGlFlags((flags) => ({ ...flags, ...patch }));
  }, []);
  const glSim = useGlSim(glFlags.glSpheres || glFlags.water || glFlags.waterFx);
  const glHealth: GlHealth = glFlags.forceFallback ? 'forced' : runtimeGlHealth;
  const glOk = glHealth === 'healthy';
  const mountGl = glFlags.glBase || glFlags.glSpheres || glFlags.water || glFlags.bgImage
    || glFlags.rtt || glFlags.waterFx || glFlags.floatMotes || glFlags.waterPlants
    || glFlags.reefStones || glFlags.crystalPillars;

  usePointerFx(glOk && glFlags.glSpheres && (glFlags.perspective || glFlags.parallax));
  useEffect(() => {
    setCameraFx({ dof: glFlags.dof, perspective: glFlags.perspective, parallax: glFlags.parallax });
  }, [glFlags.dof, glFlags.perspective, glFlags.parallax]);
  useEffect(() => { if (p9Enabled) loadP9Tuning(); }, [p9Enabled]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black" data-gl-health={glHealth}>
      {mountGl && <PondGL flags={glFlags} glSim={glSim} onHealthChange={setRuntimeGlHealth} />}
      <PondHeader />
      {glSim.ready && <GlNav glSim={glSim} />}
      {glFlags.glSpheres && (glSim.loading || glSim.error) && (
        <GlLoading error={glSim.error} onRetry={glSim.retry} />
      )}
      <div data-pond-ui="true" className="pointer-events-none fixed left-6 z-30" style={{ top: '14rem' }}>
        <div className="pointer-events-auto"><TestJam p9Enabled={p9Enabled} /></div>
      </div>
      {glFlags.glSpheres && glSim.ready && (
        <SphereOverlay glSim={glSim} waterOn={glFlags.water || glFlags.waterFx}
          glHealthy={glOk} depthModel={glFlags.depthModel} showLabels={glFlags.sphereLabels} />
      )}
      {glFlags.glSpheres && glFlags.glEclipse && glSim.ready && glOk && <GlEclipse glSim={glSim} />}
      {sandbox && <SandboxControls flags={glFlags} p9={mode === 'test3'} onChange={onGl} />}
      <DraftSavedToast />
    </main>
  );
}
