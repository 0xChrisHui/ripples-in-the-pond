import zh from './messages/zh.json';

export type Locale = 'zh' | 'en';
/** 中文词典是结构基准：英文词典必须与之同构（见 loadMessages 的类型约束与 scripts/i18n/check-messages.mjs） */
export type Messages = typeof zh;

export const DEFAULT_LOCALE: Locale = 'zh';
export const HTML_LANG: Record<Locale, string> = { zh: 'zh-CN', en: 'en' };
/** 临时统一时区，只影响 next-intl 的日期格式化（目前未使用）；正式方案在 P19 Step 5（N4）定 */
export const TIME_ZONE = 'Asia/Shanghai';

const COOKIE_RE = /(?:^|;\s*)locale=(zh|en)(?:;|$)/;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** 首帧前按 cookie 修正 <html lang>（app/layout.tsx 内联注入）；判断规则须与 COOKIE_RE 一致 */
export const LANG_BOOT_SCRIPT =
  "try{if(/(?:^|;\\s*)locale=en(?:;|$)/.test(document.cookie))document.documentElement.lang='en'}catch(e){}";

export function readLocaleCookie(): Locale {
  return COOKIE_RE.exec(document.cookie)?.[1] === 'en' ? 'en' : DEFAULT_LOCALE;
}

export function writeLocaleCookie(locale: Locale) {
  document.cookie = `locale=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

type Tree = { [key: string]: string | Tree };

/** 以中文为底逐层覆盖英文：英文万一缺 key，显示中文原文而不是 key 路径 */
function withChineseFallback(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const prev = base[key];
    out[key] = typeof prev === 'object' && typeof value === 'object' ? withChineseFallback(prev, value) : value;
  }
  return out;
}

let english: Messages | null = null;

/** 中文随页面下发；英文词典按需加载，只有选了英文才下载 */
export async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === 'zh') return zh;
  if (!english) {
    const en: Messages = (await import('./messages/en.json')).default;
    english = withChineseFallback(zh as unknown as Tree, en as unknown as Tree) as unknown as Messages;
  }
  return english;
}

/** 渲染用：英文只在已加载后才会被选中，未加载时回落中文 */
export function messagesFor(locale: Locale): Messages {
  return locale === 'en' && english ? english : zh;
}
