import { createTranslator } from 'use-intl/core';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import { TIME_ZONE, type Locale } from '../locale';

// 服务端（海报、OG 图）取文案：读两种词典，不依赖请求里的语言
const translators = {
  zh: createTranslator({ locale: 'zh', messages: zh, timeZone: TIME_ZONE }),
  en: createTranslator({ locale: 'en', messages: en, timeZone: TIME_ZONE }),
};

type OgKey = keyof typeof zh.og;
type Values = Record<string, string | number>;

/** 海报：跟随调用方指定的语言（下载链接带 ?lang=en） */
export function ogText(locale: Locale, key: OgKey, values?: Values): string {
  return translators[locale](`og.${key}` as never, values as never);
}

/** OG 图：爬虫不带 cookie、分享链接也是固定地址，无法知道读者语言，所以中英并列（英文在前） */
export function ogBilingual(key: OgKey, values?: Values): string {
  return `${ogText('en', key, values)} · ${ogText('zh', key, values)}`;
}

export function posterLocale(request: Request): Locale {
  return new URL(request.url).searchParams.get('lang') === 'en' ? 'en' : 'zh';
}
