'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

type Translate = ReturnType<typeof useTranslations<never>>;
/** 全部词典 key 的联合类型：写错 key 时 tsc 报错 */
export type MessageKey = Parameters<Translate>[0];
type Values = Record<string, string | number>;

/**
 * 存进状态或由数据层产出的文案，存 key + 插值而不是成品字符串：
 * 切换语言时已存的提示也会立即换成新语言（成品字符串会停在旧语言）。
 */
export type Msg = { key: MessageKey; values?: Values };

export const msg = (key: MessageKey, values?: Values): Msg => ({ key, values });

/** 把 Msg 翻译成当前语言的文字 */
export function useMsg() {
  const t = useTranslations();
  return useCallback((m: Msg) => t(m.key, m.values as Parameters<Translate>[1]), [t]);
}
