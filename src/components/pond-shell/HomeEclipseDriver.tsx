'use client';

import { useRef, type RefObject } from 'react';
import { useEclipseTransition } from '@/src/components/pond-gl-test3/focus/useEclipseTransition';
import type { GlSim } from '@/src/components/pond-gl-test3/spheres/use-gl-sim';
import type { Track36VisitorState } from '@/src/components/pond-gl-test3/visitor/track36-state';
import type { ResidentEchoRuntime } from '@/src/types/echo-resident';

/** Score 接管水面时卸载，保证全局播放焦点只有一个 RAF 驱动。 */
export default function HomeEclipseDriver({ glSim, visitor, playingId, resident }: {
  glSim: GlSim; visitor?: RefObject<Track36VisitorState | null>; playingId: string | null;
  resident?: { runtime: ResidentEchoRuntime; playbackId: string };
}) {
  const empty=useRef<Track36VisitorState|null>(null);
  useEclipseTransition(glSim, visitor??empty, playingId, resident);
  return null;
}
