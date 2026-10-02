'use client';

import { useEffect, useState } from 'react';

/** 首页或档案首次出现后持续保留唯一档案实例，后续路由往返不重复请求。 */
export function usePreparedArchive(pathname: string, persistent: boolean): boolean {
  const archivePath = pathname === '/me' || pathname === '/me/test';
  const [initialized, setInitialized] = useState(() => pathname === '/' || archivePath);
  useEffect(() => {
    if (!initialized && (pathname === '/' || archivePath)) {
      queueMicrotask(() => setInitialized(true));
    }
  }, [archivePath, initialized, pathname]);
  return persistent && initialized;
}
