'use client';

import { NextIntlClientProvider } from 'next-intl';
import {
  createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_LOCALE, HTML_LANG, TIME_ZONE, loadMessages, messagesFor, readLocaleCookie, writeLocaleCookie,
  type Locale,
} from './locale';
import { useLocalizedTitle } from './use-localized-title';

/** locale 是当前已生效的语言；pendingLocale 是最后一次点选的目标（英文词典下载期间两者不同，点回当前语言即可取消） */
type LocaleSwitch = { locale: Locale; pendingLocale: Locale; setLocale: (next: Locale) => void };

const LocaleSwitchContext = createContext<LocaleSwitch>({ locale: DEFAULT_LOCALE, pendingLocale: DEFAULT_LOCALE, setLocale: () => {} });

/** 读当前语言 / 切换语言（Step 2 的 CN/EN 按钮用） */
export function useLocaleSwitch() {
  return useContext(LocaleSwitchContext);
}

/**
 * P19 方案 C：服务端与水合首帧固定中文，必须与静态 HTML 一致，否则 hydration 失败、整棵树在客户端重建。
 * 水合后读 cookie，英文词典到位再用 transition 切换：只换词典，不刷新页面、不重挂载，音乐与水面不受影响。
 */
export default function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [pendingLocale, setPendingLocale] = useState<Locale>(DEFAULT_LOCALE);
  const active = useRef<Locale>(DEFAULT_LOCALE);
  const requested = useRef<Locale>(DEFAULT_LOCALE);

  const apply = useCallback(async (target: Locale) => {
    requested.current = target;
    setPendingLocale(target);
    const ready = await loadMessages(target).then(() => true, (error: unknown) => {
      console.error('[i18n] 词典加载失败，保持当前语言', error);
      return false;
    });
    if (requested.current !== target) return; // 连续切换时只认最后一次
    const next = ready ? target : active.current;
    active.current = next;
    setPendingLocale(next);
    document.documentElement.lang = HTML_LANG[next];
    startTransition(() => setLocaleState(next));
  }, []);

  const setLocale = useCallback((next: Locale) => {
    writeLocaleCookie(next);
    void apply(next);
  }, [apply]);

  useEffect(() => {
    const saved = readLocaleCookie();
    // 微任务里再进 apply：apply 开头会同步更新 pendingLocale，不能直接在 effect 体内 setState
    if (saved !== DEFAULT_LOCALE) void Promise.resolve().then(() => apply(saved));
  }, [apply]);

  useLocalizedTitle(locale);
  const value = useMemo(() => ({ locale, pendingLocale, setLocale }), [locale, pendingLocale, setLocale]);

  return (
    <LocaleSwitchContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messagesFor(locale)} timeZone={TIME_ZONE}>
        {children}
      </NextIntlClientProvider>
    </LocaleSwitchContext.Provider>
  );
}
