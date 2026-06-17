import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * /test2 实验页 — P8-K7 参考水实验场（2026-06-18）。
 * 移植 references/flower-water-ripples 的明亮日光水 + 叠我们的球，水位卡中段感受 50/50 观感。
 * 纯实验、不入生产：与 /test1 一样不被搜索引擎收录、不放任何外部入口链接。
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Test2Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
