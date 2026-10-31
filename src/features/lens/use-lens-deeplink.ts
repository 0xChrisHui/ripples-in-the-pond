'use client';
import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMusicCatalog } from '@/src/lib/music-catalog/asset-registry';
import type { LensSelection } from './use-lens-frame';

/** 曲号（displayNumber）⇄ 球 id（= trackId）。目录只在 /lens 的异步 chunk 里读取，不进首页。 */
export function useTrackNumbers() {
  return useMemo(() => {
    const byNumber = new Map<number, string>(), byId = new Map<string, number>();
    for (const track of getMusicCatalog().tracks) { byNumber.set(track.displayNumber, track.trackId); byId.set(track.trackId, track.displayNumber); }
    return { byNumber, byId };
  }, []);
}

/**
 * `/lens?track=N`：进入或站内换 query 时，光圈落在第 N 球，只选中不自动播放。
 * 选中 / 播放后用 replaceState 写回地址（不新增历史）；写回自己的值不会再次触发选中。
 */
export function useLensDeepLink(args: {
  active: boolean; ready: boolean; numbers: ReturnType<typeof useTrackNumbers>;
  selectionRef: MutableRefObject<LensSelection>;
}) {
  const { active, ready, numbers, selectionRef } = args;
  const param = useSearchParams().get('track');
  const written = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !ready || param == null || param === written.current) return;
    const id = numbers.byNumber.get(Number(param));
    if (id && selectionRef.current?.id !== id) selectionRef.current = { id, source: 'deeplink' };
  }, [active, numbers, param, ready, selectionRef]);
  return useCallback((id: string | null) => {
    const number = id ? numbers.byId.get(id) : undefined;
    const url = new URL(window.location.href);
    if (number == null) { if (!url.searchParams.has('track')) return; url.searchParams.delete('track'); written.current = null; }
    else { if (url.searchParams.get('track') === String(number)) return; url.searchParams.set('track', String(number)); written.current = String(number); }
    window.history.replaceState(window.history.state, '', url);
  }, [numbers]);
}
