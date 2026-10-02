'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';
import type { OwnedScoreNFT } from '@/src/types/jam';
import { ownedScoreHref } from './archive/score-route';

/** 预取真正被导航消费的 RSC；verified snapshot 曲谱随页面数据缓存，不额外下载音频。 */
export function useScoreRoutePreload(active: boolean, scores: readonly OwnedScoreNFT[]) {
  const router = useRouter();
  const scheduled = useRef(new Set<string>());
  useEffect(() => {
    if (!active) return;
    const hrefs = [...new Set(scores.filter((score) => score.status === 'success'
      && score.tokenId != null).map(ownedScoreHref))];
    let next = 0;
    const timer = window.setInterval(() => {
      const href = hrefs[next++];
      if (!href) { window.clearInterval(timer); return; }
      if (scheduled.current.has(href)) return;
      scheduled.current.add(href);
      // AUTO 遇到 loading.tsx 只预取外壳；FULL 才包含实际唱片和内嵌曲谱。
      router.prefetch(href, { kind: PrefetchKind.FULL,
        onInvalidate: () => { scheduled.current.delete(href); } });
    }, 150);
    return () => window.clearInterval(timer);
  }, [active, router, scores]);
}
