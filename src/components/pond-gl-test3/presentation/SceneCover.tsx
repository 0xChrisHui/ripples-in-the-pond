'use client';

import type { GLFlags } from '../gl-flags';
import { POND_NIGHT_BACKGROUND, POND_NIGHT_BLACK } from './pond-night';
import SlowRipple from './SlowRipple';

/** 最终合成首帧完成前遮住 Canvas，并保持日食黑场语义。 */
export default function SceneCover({ artDir, visible, waiting = false }: {
  artDir: GLFlags['artDir']; visible: boolean;
  /** 仍在等水面就绪时为 true：超过 3 秒挂慢网涟漪。 */
  waiting?: boolean;
}) {
  const background = artDir === 'black' ? POND_NIGHT_BLACK : POND_NIGHT_BACKGROUND;
  return (
    <div aria-hidden="true" data-pond-scene-cover="true" data-visible={visible}
      className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ background }}>
      {waiting && <SlowRipple />}
      <div className="absolute inset-0 bg-black" style={{ opacity: 'var(--pond-eclipse-mix, 0)' }} />
    </div>
  );
}
