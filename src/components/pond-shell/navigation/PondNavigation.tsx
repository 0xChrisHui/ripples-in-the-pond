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
    // 路由预取不会准备常驻曲目前景；空闲时提前加载，避免首次点击串行等待两个chunk。
    const warm = () => { void import('@/src/features/home-pond/PreparedTracks'); };
    if ('requestIdleCallback' in window) {
      const idle = window.requestIdleCallback(warm, { timeout: 800 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = setTimeout(warm, 100);
    return () => clearTimeout(timer);
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
