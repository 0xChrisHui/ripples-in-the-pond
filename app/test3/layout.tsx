import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * /test3 — 真透明合成正式版本。
 * 渲染层走 `@/src/components/pond-gl-test3/`。
 * 与 /test1 一样长期保留作试验场，但不被搜索引擎收录、不放任何外部入口链接。
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Test3Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
