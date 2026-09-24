'use client';

import { useState } from 'react';
import MeArchivePage from '@/src/components/me/archive/MeArchivePage';
import './me-pond.css';

const STANDARD_VEIL_OPACITY = 75;

type MePondArchiveProps = {
  showControls?: boolean;
  onPrepared?: (ready: boolean) => void;
};

/** 正式个人档案复用首页水面，只留下池塘、月光与花瓣。 */
export default function MePondArchive({ showControls = false, onPrepared }: MePondArchiveProps) {
  const [veilEnabled, setVeilEnabled] = useState(false);
  const [veilOpacity, setVeilOpacity] = useState(STANDARD_VEIL_OPACITY);

  return (
    <div className="me-pond" data-pond-health="shared" data-scene-ready="true">
      <div
        className="me-pond__veil"
        aria-hidden="true"
        style={{ opacity: veilEnabled ? veilOpacity / 100 : 0 }}
      />
      <MeArchivePage variant="pond" onPrepared={onPrepared} />
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
