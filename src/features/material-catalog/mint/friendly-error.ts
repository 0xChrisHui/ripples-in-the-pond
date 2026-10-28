import type { Locale } from '../../../i18n/locale';

/** 词典键（material 命名空间下）。提示里只存键，不存翻译成品：切换语言后同一条提示立即换语言。 */
export type MaterialNoticeKey = string;
export type MaterialNotice = {
  tone: 'info' | 'warn' | 'error';
  titleKey: MaterialNoticeKey; hintKey?: MaterialNoticeKey;
  /** 服务端/本地给出的简短中文原文：仅中文模式直接当标题 */
  plain?: string;
  /** 技术详情原文：英文模式遇到中文原文不展示 */
  detail?: string;
};
export type RenderedMaterialNotice = { tone: MaterialNotice['tone']; title: string; hint?: string; detail?: string };

const REVIEW_HINT = 'notice.reviewHint';

function chain(error: unknown) {
  const codes: unknown[] = [], texts: string[] = [];
  for (let current = error, depth = 0; current && typeof current === 'object' && depth < 6; depth++) {
    const value = current as { code?: unknown; message?: unknown; shortMessage?: unknown; cause?: unknown };
    codes.push(value.code); if (typeof value.shortMessage === 'string') texts.push(value.shortMessage);
    if (typeof value.message === 'string') texts.push(value.message); current = value.cause;
  }
  if (typeof error === 'string') texts.push(error);
  return { codes, text: texts.join('\n') };
}

/**
 * 把钱包/网络/服务端异常转成面向收藏者的提示（只含词典键与原文，不含翻译成品）；原始信息只放进折叠的技术详情。
 * 渲染时由 renderMaterialNotice 按当前语言取词：中文沿用“简短中文原文可直接作标题”，英文不显示中文原文（P19 F5）。
 */
export function describeMaterialError(error: unknown, fallbackKey: MaterialNoticeKey = 'notice.fallback'): MaterialNotice {
  const { codes, text } = chain(error);
  if (codes.some(code => code === 4001 || code === '4001') || /user (rejected|denied)/i.test(text)) {
    return { tone: 'info', titleKey: 'notice.rejectedTitle', hintKey: 'notice.rejectedHint' };
  }
  if (/ETH不足|insufficient funds/i.test(text)) {
    return { tone: 'warn', titleKey: 'notice.fundsTitle', hintKey: 'notice.fundsHint' };
  }
  if (/failed to fetch|http request failed|network|timeout|timed out/i.test(text)) {
    return { tone: 'warn', titleKey: 'notice.networkTitle', hintKey: 'notice.networkHint', detail: text.slice(0, 400) };
  }
  const plain = text.split('\n')[0]?.trim() ?? '';
  const readable = plain.length > 0 && plain.length <= 48 && /[一-龥]/.test(plain) && !/https?:|0x[0-9a-f]{8}/i.test(plain);
  return { tone: 'error', titleKey: fallbackKey, hintKey: REVIEW_HINT,
    ...(readable ? { plain } : { detail: text.slice(0, 400) || undefined }) };
}

/** 本地已知原因（不经异常）直接成提示 */
export function localMaterialNotice(titleKey: MaterialNoticeKey): MaterialNotice {
  return { tone: 'error', titleKey, hintKey: REVIEW_HINT };
}

/** 按当前语言取词。英文模式：中文原文既不作标题也不进技术详情（详情含中文则整体隐藏）。 */
export function renderMaterialNotice(
  notice: MaterialNotice, locale: Locale, t: (key: MaterialNoticeKey) => string,
): RenderedMaterialNotice {
  const zh = locale === 'zh';
  const detail = notice.detail && (zh || !/[一-龥]/.test(notice.detail)) ? notice.detail : undefined;
  return { tone: notice.tone, title: zh && notice.plain ? notice.plain : t(notice.titleKey),
    hint: notice.hintKey ? t(notice.hintKey) : undefined, detail };
}
