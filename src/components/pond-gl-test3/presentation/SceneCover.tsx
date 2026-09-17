'use client';

import type { GLFlags } from '../gl-flags';

/** 最终合成首帧完成前遮住 Canvas，并保持日食黑场语义。 */
export default function SceneCover({ artDir, visible }: { artDir: GLFlags['artDir']; visible: boolean }) {
  const background = artDir === 'black'
    ? '#000'
    : 'radial-gradient(ellipse at 50% 50%, #030a09 0%, #010303 82%)';
  return (
    <div aria-hidden="true" data-pond-scene-cover="true" data-visible={visible}
      className={`pointer-events-none absolute inset-0 transition-opacity duration-150 motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ background }}>
      <div className="absolute inset-0 bg-black" style={{ opacity: 'var(--pond-eclipse-mix, 0)' }} />
    </div>
  );
}
