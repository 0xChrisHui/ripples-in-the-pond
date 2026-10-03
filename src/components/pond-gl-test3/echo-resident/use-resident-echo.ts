'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ResidentEchoOptions, ResidentEchoRuntime } from '../../../types/echo-resident';
import { createResidentEchoRuntime } from './runtime';
import { createVisualSeed } from './random';

function createHostStore() {
  let runtime: ResidentEchoRuntime | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => runtime,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(next: ResidentEchoRuntime | null) { runtime = next; for (const listener of listeners) listener(); },
  };
}
/** 宿主只挂一次；布局/group 更新经 step 输入，不能用 group 当 hook 或组件 key。 */
export function useResidentEcho(options: ResidentEchoOptions): ResidentEchoRuntime | null {
  const [initial] = useState(() => ({ ...options, seed: options.seed ?? createVisualSeed() }));
  const [host] = useState(createHostStore);
  const runtime = useSyncExternalStore(host.subscribe, host.getSnapshot, () => null);
  useEffect(() => {
    const active = createResidentEchoRuntime(initial);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const visibility = () => active.setVisibility(document.hidden);
    const preference = () => active.setReducedMotion(media.matches);
    visibility(); preference(); host.set(active);
    document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', preference);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      media.removeEventListener('change', preference);
      active.destroy(); host.set(null);
    };
  }, [host, initial]);
  return runtime;
}
