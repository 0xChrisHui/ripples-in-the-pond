'use client';

import { useCallback } from 'react';
import { useLocaleSwitch } from './LocaleProvider';

/**
 * 服务器返回的报错原文目前是中文（API 错误码改造在 P19 Step 7）。
 * 中文模式照旧显示原文（与上线行为一致）；英文模式一律改用前端文案，不把中文原文漏给英文用户。
 */
export function useServerText() {
  const { locale } = useLocaleSwitch();
  return useCallback(
    (serverText: string | null | undefined, fallback: string) => (locale === 'zh' && serverText ? serverText : fallback),
    [locale],
  );
}
