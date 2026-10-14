import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useLocaleSwitch } from '../../../i18n/LocaleProvider';
import type { Locale } from '../../../i18n/locale';

export type MaterialNotice = { tone: 'info' | 'warn' | 'error'; title: string; hint?: string; detail?: string };

/** 面向收藏者的提示文案（由 useMaterialErrorCopy 按当前语言提供） */
export type MaterialErrorCopy = {
  locale: Locale; fallback: string; reviewHint: string;
  rejected: { title: string; hint: string }; funds: { title: string; hint: string }; network: { title: string; hint: string };
};

export function useMaterialErrorCopy(): MaterialErrorCopy {
  const t = useTranslations('material.notice');
  const { locale } = useLocaleSwitch();
  return useMemo(() => ({
    locale, fallback: t('fallback'), reviewHint: t('reviewHint'),
    rejected: { title: t('rejectedTitle'), hint: t('rejectedHint') },
    funds: { title: t('fundsTitle'), hint: t('fundsHint') },
    network: { title: t('networkTitle'), hint: t('networkHint') },
  }), [locale, t]);
}

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
 * 把钱包/网络/服务端异常转成面向收藏者的文案；原始信息只放进折叠的技术详情。
 * 中文模式沿用“简短中文原文可直接作标题”；英文模式不把中文原文当标题，原文进技术详情（P19 F5）。
 */
export function describeMaterialError(error: unknown, copy: MaterialErrorCopy, fallback = copy.fallback): MaterialNotice {
  const { codes, text } = chain(error);
  if (codes.some(code => code === 4001 || code === '4001') || /user (rejected|denied)/i.test(text)) {
    return { tone: 'info', ...copy.rejected };
  }
  if (/ETH不足|insufficient funds/i.test(text)) {
    return { tone: 'warn', ...copy.funds };
  }
  if (/failed to fetch|http request failed|network|timeout|timed out/i.test(text)) {
    return { tone: 'warn', ...copy.network, detail: text.slice(0, 400) };
  }
  const plain = text.split('\n')[0]?.trim() ?? '';
  const readable = copy.locale === 'zh' && plain.length > 0 && plain.length <= 48 && /[一-龥]/.test(plain)
    && !/https?:|0x[0-9a-f]{8}/i.test(plain);
  return { tone: 'error', title: readable ? plain : fallback,
    hint: copy.reviewHint, detail: readable ? undefined : text.slice(0, 400) || undefined };
}
