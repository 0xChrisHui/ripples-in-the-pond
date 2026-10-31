'use client';
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_GL_FLAGS, parseGLFlags, type GLFlags } from '@/src/components/pond-gl-test3/gl-flags';
import { readDevFakeEcho } from '@/src/hooks/echo/dev-fake-echo';
import { LAB_PATH } from '@/src/components/pond-shell/transition/types';

/** 挂载 id、URL 开关与开发假 #36：只在客户端水合后读一次，不用 useSearchParams（会拖外壳进 Suspense）。 */
export function useHomeFlags() {
  const [mountId, setMountId] = useState<string | null>(null);
  const [glFlags, setGlFlags] = useState<GLFlags>(DEFAULT_GL_FLAGS);
  const [devFakeEcho, setDevFakeEcho] = useState<ReturnType<typeof readDevFakeEcho>>(null);
  useEffect(() => {
    queueMicrotask(() => setMountId(`pond-${crypto.randomUUID()}`));
    const search = window.location.search;
    if (search || window.location.pathname === LAB_PATH) queueMicrotask(() => {
      const sp = new URLSearchParams(search);
      const parsed = parseGLFlags(sp);
      // /test5 默认打开气泡与假 #36，便于直接调参；URL 参数仍可显式覆盖
      const isLab = window.location.pathname === LAB_PATH;
      setGlFlags(isLab && !sp.has('pondBubbles') ? { ...parsed, pondBubbles: true } : parsed);
      setDevFakeEcho(isLab && !sp.has('fakeEcho') ? readDevFakeEcho('?fakeEcho=1') : readDevFakeEcho(search));
    });
  }, []);
  const onGl = useCallback((patch: Partial<GLFlags>) => {
    setGlFlags((flags) => ({ ...flags, ...patch }));
  }, []);
  return { mountId, glFlags, devFakeEcho, onGl };
}
