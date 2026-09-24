'use client';

import dynamic from 'next/dynamic';
import type { RefObject } from 'react';
import type { GLFlags } from '@/src/components/pond-gl-test3/gl-flags';
import type { GlHealth } from '@/src/components/pond-gl-test3/PondGL';
import type { GlSim } from '@/src/components/pond-gl-test3/spheres/use-gl-sim';
import type { Track36VisitorState } from '@/src/components/pond-gl-test3/visitor/track36-state';

const PondGL = dynamic(() => import('@/src/components/pond-gl-test3/PondGL'), { ssr: false });

type Props = {
  flags: GLFlags;
  glSim?: GlSim;
  visitor?: RefObject<Track36VisitorState | null>;
  scenePresence?: RefObject<number>;
  reducedSceneMotion?: boolean;
  pointerInteractive?: boolean;
  onHealthChange: (health: GlHealth) => void;
  onSceneReadyChange?: (ready: boolean) => void;
  onPerformanceChange?: (degraded: boolean) => void;
};

/** 生产路由唯一的水面所有者；Scene 只能通过属性借用它，不能自行创建 Canvas。 */
export default function PersistentWaterCore(props: Props) {
  return <PondGL {...props} />;
}
