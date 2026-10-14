import type { Locale, Messages } from './locale';

// 让 t('ns.key') 的 key 与 locale 值都有类型检查：写错 key 时 tsc 直接报错
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
