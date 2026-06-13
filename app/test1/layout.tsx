import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * /test1 sandbox — P8-G GL 渲染层 spike（2026-06-12 立项）。
 * 与 /test 一样长期保留作试验场，但不被搜索引擎收录、不放任何外部入口链接。
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Test1Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
