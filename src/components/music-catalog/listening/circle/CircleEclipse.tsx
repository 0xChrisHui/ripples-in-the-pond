'use client';
import { useId } from 'react';

/** 只保留基础黑盘、白环和日冕；不采样按键或展示编舞。 */
export default function CircleEclipse() {
  const id = useId().replace(/:/g, '');
  return <svg className="track-circle__eclipse" viewBox="0 0 640 640" aria-hidden="true">
    <defs><radialGradient id={`${id}-corona`}>
      <stop offset="0" stopColor="white" stopOpacity=".08" />
      <stop offset="60%" stopColor="white" stopOpacity=".18" />
      <stop offset="66%" stopColor="white" stopOpacity=".55" />
      <stop offset="80%" stopColor="white" stopOpacity=".12" />
      <stop offset="93%" stopColor="white" stopOpacity=".025" />
      <stop offset="100%" stopColor="white" stopOpacity="0" />
    </radialGradient></defs>
    <g data-circle-eclipse="true" transform="translate(320 320) scale(3.584)">
      <circle className="track-circle__corona" r="80" fill={`url(#${id}-corona)`} />
      <circle r="50" fill="black" />
      <circle r="50.5" fill="none" stroke="white" strokeWidth="1.2" strokeOpacity=".92" vectorEffect="non-scaling-stroke" />
    </g>
  </svg>;
}
