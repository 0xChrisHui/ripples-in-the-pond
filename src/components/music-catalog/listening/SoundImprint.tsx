'use client';
import { useId, useMemo, type CSSProperties } from 'react';
import type { TrackImprint } from '../../../lib/music-catalog/experience/imprints';

type Point = { x: number; y: number };

/** 轮廓沿时间轴采样真实 RMS 与过零密度，不使用随机数或曲目编号生成造型。 */
function contours(imprint: TrackImprint): { points: Point[]; start: number; gap: number }[] {
  const { envelope, texture } = imprint;
  const smooth = (values: number[], i: number) => [-2, -1, 0, 1, 2].reduce((sum, offset) =>
    sum + values[(i + offset + values.length) % values.length], 0) / 5;
  return Array.from({ length: 7 }, (_, layer) => {
    const points = envelope.map((_, i) => {
      const angle = i / envelope.length * Math.PI * 2 - Math.PI / 2;
      const energy = smooth(envelope, i);
      const grain = smooth(texture, i);
      const radius = 22 + layer * (23 + layer * 1.1) + energy * (36 + layer * 6) + grain * 12;
      return { x: 320 + Math.cos(angle) * radius * 1.04, y: 320 + Math.sin(angle) * radius * .93 };
    });
    // 各时间区间的最低能量点形成断口；纹理决定开口大小。
    const indices = envelope.map((_, i) => i).filter((i) => Math.floor(i * 7 / envelope.length) === layer);
    const start = indices.reduce((quietest, i) => envelope[i] < envelope[quietest] ? i : quietest, indices[0]);
    return { points, start, gap: 3 + Math.round(texture[start] * 5) };
  });
}

function curve(points: Point[]): string {
  const point = (p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  return `M${point(points[0])} ${points.slice(1).map((p, i) => {
    const previous = points[i];
    return `Q${point(previous)} ${point({ x: (previous.x + p.x) / 2, y: (previous.y + p.y) / 2 })}`;
  }).join(' ')} L${point(points.at(-1)!)}`;
}

export default function SoundImprint({ imprint, trackId, phase, progress }: {
  imprint: TrackImprint; trackId: string; phase: string; progress: number;
}) {
  const id = useId().replace(/:/g, '');
  const shapes = useMemo(() => contours(imprint), [imprint]);
  const sample = Math.min(95.999, Math.max(0, progress) * 96);
  const index = Math.floor(sample); const fraction = sample - index;
  const a = shapes[4].points[index]; const b = shapes[4].points[(index + 1) % 96];
  const marker = { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction };
  const energy = phase === 'playing' ? imprint.envelope[index] : 0;
  return <figure className="sound-imprint" data-imprint-track={trackId} data-phase={phase}
    style={{ '--imprint-energy': energy } as CSSProperties}>
    <svg viewBox="0 0 640 640" role="img" aria-label="由这首原曲的真实声音生成的水纹刻印">
      <defs>
        <linearGradient id={`${id}-ink`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2c8a5" /><stop offset=".5" stopColor="#b99a74" />
          <stop offset="1" stopColor="#688477" />
        </linearGradient>
        <radialGradient id={`${id}-wash`}><stop stopColor="#8b9e88" stopOpacity=".12" />
          <stop offset="1" stopColor="#8b9e88" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="320" cy="320" rx="270" ry="260" fill={`url(#${id}-wash)`} />
      <g className="sound-imprint__contours" fill="none" stroke={`url(#${id}-ink)`}>
        {shapes.map(({ points, start, gap }, layer) => <path key={layer}
          d={curve(Array.from({ length: points.length - gap }, (_, i) => points[(start + gap + i) % points.length]))}
          vectorEffect="non-scaling-stroke" strokeWidth={layer % 3 === 0 ? 1.1 : .65} opacity={.4 + layer / 12} />)}
        {phase === 'playing' && <circle className="sound-imprint__cursor" cx={marker.x} cy={marker.y} r="3.2"
          stroke="none" fill="#f2dbc0" />}
      </g>
    </svg>
  </figure>;
}
