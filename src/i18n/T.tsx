'use client';

import { useTranslations } from 'next-intl';

type Translate = ReturnType<typeof useTranslations<never>>;
type Key = Parameters<Translate>[0];
type Values = Parameters<Translate>[1];

/**
 * 服务端组件里的“客户端文字片段”（P19 F3）：静态 HTML 仍输出中文，水合后随语言切换。
 * 只用于纯文本；属性（aria-label、metadata）需要整块放进客户端组件。
 */
export default function T({ k, values }: { k: Key; values?: Values }) {
  const t = useTranslations();
  return t(k, values);
}
