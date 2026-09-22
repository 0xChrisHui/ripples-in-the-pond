'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import MeArchivePage from '@/src/components/me/archive/MeArchivePage';
import { DEFAULT_GL_FLAGS, type GLFlags } from '@/src/components/pond-gl-test3/gl-flags';
import type { GlHealth } from '@/src/components/pond-gl-test3/PondGL';
import './me-pond.css';

const PondGL = dynamic(() => import('@/src/components/pond-gl-test3/PondGL'), { ssr: false });
const STANDARD_VEIL_OPACITY = 75;

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

type MePondArchiveProps = {
  showControls?: boolean;
};

/** 正式个人档案复用首页水面，只留下池塘、月光与花瓣。 */
export default function MePondArchive({ showControls = false }: MePondArchiveProps) {
  const [health, setHealth] = useState<GlHealth>('unavailable');
  const [sceneReady, setSceneReady] = useState(false);
  const [veilEnabled, setVeilEnabled] = useState(false);
  const [veilOpacity, setVeilOpacity] = useState(STANDARD_VEIL_OPACITY);

  return (
    <div className="me-pond" data-pond-health={health} data-scene-ready={sceneReady}>
      <div className="me-pond__scene" aria-hidden="true">
        <PondGL
          flags={ARCHIVE_POND_FLAGS}
          pointerInteractive
          onHealthChange={setHealth}
          onSceneReadyChange={setSceneReady}
        />
      </div>
      <div
        className="me-pond__veil"
        aria-hidden="true"
        style={{ opacity: veilEnabled ? veilOpacity / 100 : 0 }}
      />
      <MeArchivePage variant="pond" />
      {showControls ? (
        <div
          className="me-pond__controls"
          role="group"
          aria-label="水面显示设置"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-pressed={veilEnabled}
            onClick={() => setVeilEnabled((current) => !current)}
          >
            <span aria-hidden="true" />
            遮罩 {veilEnabled ? '开' : '关'}
          </button>
          <label>
            <span>透明度</span>
            <input
              type="range"
              min="0"
              max="100"
              value={veilOpacity}
              aria-label="遮罩透明度"
              onChange={(event) => {
                setVeilOpacity(Number(event.target.value));
                setVeilEnabled(true);
              }}
            />
            <output>{veilOpacity}%</output>
          </label>
        </div>
      ) : null}
    </div>
  );
}
