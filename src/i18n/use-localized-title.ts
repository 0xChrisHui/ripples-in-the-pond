'use client';

import { useEffect } from 'react';
import zh from './messages/zh.json';
import { messagesFor, type Locale } from './locale';

// Next 写入的（中文）标题，与本模块最后一次替换后的标题；跨语言切换保留，用于切回中文时还原
let source: string | null = null;
let applied: string | null = null;

function translate(title: string, locale: Locale): string {
  if (locale === 'zh') return title;
  const en = messagesFor(locale).titles;
  return (Object.keys(zh.titles) as (keyof typeof zh.titles)[])
    .reduce((text, key) => text.split(zh.titles[key]).join(en[key]), title);
}

function sync(locale: Locale) {
  const now = document.title;
  if (now !== applied) source = now; // Next 换了新页面的标题
  const target = source ? translate(source, locale) : now;
  applied = target;
  if (now !== target) document.title = target;
}

/**
 * P19 D6：服务端 metadata 固定中文（页面保持静态）；英文模式下由浏览器把标签页标题里的中文片段换成英文。
 * 监听 <head> 变化：Next 站内换页改写标题后立即再替换一次。
 */
export function useLocalizedTitle(locale: Locale) {
  useEffect(() => {
    sync(locale);
    const observer = new MutationObserver(() => sync(locale));
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);
}
