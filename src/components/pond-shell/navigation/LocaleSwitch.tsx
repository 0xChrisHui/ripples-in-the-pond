'use client';

import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { useLocaleSwitch } from '@/src/i18n/LocaleProvider';
import type { Locale } from '@/src/i18n/locale';

/** P19：右上角 CN/EN 露出开关。Step 8 前保持 false（线上零变化）；开发时可手动写 cookie `locale=en` 测试。 */
export const LOCALE_SWITCH_VISIBLE = false;

// 语言名用各自语言书写、不随界面翻译（无障碍惯例），所以不进词典
const OPTIONS: { locale: Locale; label: string; name: string; lang: string }[] = [
  { locale: 'zh', label: 'CN', name: '中文', lang: 'zh-CN' },
  { locale: 'en', label: 'EN', name: 'English', lang: 'en' },
];

/** 全站唯一的语言切换：挂在 PondHeader（所有生产页面的右上角都经由它）。点击只换词典，不刷新页面。 */
export default function LocaleSwitch() {
  const t = useTranslations('localeSwitch');
  const { locale, setLocale } = useLocaleSwitch();
  if (!LOCALE_SWITCH_VISIBLE) return null;
  return (
    <div role="group" aria-label={t('label')} className="pond-locale-switch">
      {OPTIONS.map((option, index) => (
        <Fragment key={option.locale}>
          {index > 0 && <span className="pond-locale-switch__sep" aria-hidden="true">/</span>}
          <button
            type="button"
            lang={option.lang}
            aria-label={option.name}
            aria-pressed={locale === option.locale}
            onClick={() => { if (locale !== option.locale) setLocale(option.locale); }}
            className="pond-locale-switch__option"
          >
            {option.label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
