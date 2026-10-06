'use client';

import { useId, type Ref } from 'react';

/** 首页与曲目页共用贴合黑核的白环和连续日冕，编舞由外层单独叠加。 */
export default function EclipseBody({ coreRef, ringRef, haloRef, gradientRef }: {
  coreRef?: Ref<SVGGElement>; ringRef?: Ref<SVGCircleElement>;
  haloRef?: Ref<SVGCircleElement>; gradientRef?: Ref<SVGRadialGradientElement>;
}) {
  const id = `eclipse-${useId().replace(/:/g, '')}`;
  return <>
    <defs>
      <radialGradient ref={gradientRef} id={id} style={{ color: 'white' }}>
        <stop offset="0%" stopColor="currentColor" stopOpacity=".08" />
        <stop offset="22%" stopColor="currentColor" stopOpacity=".62" />
        <stop offset="24%" stopColor="currentColor" stopOpacity=".55" />
        <stop offset="36%" stopColor="currentColor" stopOpacity=".32" />
        <stop offset="60%" stopColor="currentColor" stopOpacity=".10" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle ref={haloRef} r="220" fill={`url(#${id})`} />
    <g ref={coreRef}><circle r="50" fill="black" /></g>
    <circle ref={ringRef} r="50.4" fill="none" stroke="white" strokeWidth="1.2" strokeOpacity=".92" />
  </>;
}
