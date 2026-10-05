'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginButton from '../../auth/LoginButton';
import PondRouteLink from '../PondRouteLink';
import './navigation.css';

export function usePondNavigationWarmup(): void {
  const router = useRouter();
  useEffect(() => {
    router.prefetch('/artist'); router.prefetch('/tracks'); router.prefetch('/me');
  }, [router]);
}

/** 公开外壳提前准备，私人数据仍由已有身份隔离的档案实例负责。 */
export default function PondNavigation({ showTracks = false }: { showTracks?: boolean }) {
  usePondNavigationWarmup();
  return <nav className="pond-page-navigation" aria-label="主导航">
    <PondRouteLink href="/artist">艺术家</PondRouteLink>
    {showTracks && <PondRouteLink href="/tracks">曲目</PondRouteLink>}
    <LoginButton />
  </nav>;
}
