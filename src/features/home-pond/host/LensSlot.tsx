'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { GlSim } from '@/src/components/pond-gl-test3/spheres/use-gl-sim';
import { LENS_PATH } from '@/src/components/pond-shell/transition/types';

const LensLayer = dynamic(() => import('@/src/features/lens/LensLayer'), { ssr: false });

/** 首次进入 /lens 才下载功能层；之后保持挂载（离开时只淡出，不重建）。 */
export default function LensSlot({ pathname, glSim, stopEcho }: {
  pathname: string; glSim: GlSim; stopEcho: () => void;
}) {
  const [opened, setOpened] = useState(pathname === LENS_PATH);
  useEffect(() => { if (pathname === LENS_PATH) queueMicrotask(() => setOpened(true)); }, [pathname]);
  return opened ? <LensLayer pathname={pathname} glSim={glSim} stopEcho={stopEcho} /> : null;
}
