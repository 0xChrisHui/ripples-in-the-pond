'use client';

import { useEffect, type ReactNode } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';

/** Score 路由边界：进入即终止全局试听，离开后不恢复旧曲。 */
export default function ScoreLayout({ children }: { children: ReactNode }) {
  const { stop } = usePlayer();
  useEffect(() => { stop(); }, [stop]);
  return children;
}
