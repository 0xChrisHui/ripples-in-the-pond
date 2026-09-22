'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import MeArchivePage from '@/src/components/me/archive/MeArchivePage';
import { DEFAULT_GL_FLAGS, type GLFlags } from '@/src/components/pond-gl-test3/gl-flags';
import type { GlHealth } from '@/src/components/pond-gl-test3/PondGL';
import './test.css';

const PondGL = dynamic(() => import('@/src/components/pond-gl-test3/PondGL'), { ssr: false });

const ARCHIVE_POND_FLAGS: GLFlags = {
  ...DEFAULT_GL_FLAGS,
  glSpheres: false,
  sphereLabels: false,
  sphereMotion: false,
  sphereDrift: false,
  glEclipse: false,
  floatMotes: false,
  waterPlants: false,
  reefStones: false,
  crystalPillars: false,
};

/** `/me/test` 静水档案：复用首页水面，只留下池塘、月光与花瓣。 */
export default function MePondTestPage() {
  const [health, setHealth] = useState<GlHealth>('unavailable');
  const [sceneReady, setSceneReady] = useState(false);

  return (
    <div className="me-pond-test" data-pond-health={health} data-scene-ready={sceneReady}>
      <div className="me-pond-test__scene" aria-hidden="true">
        <PondGL
          flags={ARCHIVE_POND_FLAGS}
          pointerInteractive={false}
          onHealthChange={setHealth}
          onSceneReadyChange={setSceneReady}
        />
      </div>
      <div className="me-pond-test__veil" aria-hidden="true" />
      <MeArchivePage variant="pond" />
    </div>
  );
}
