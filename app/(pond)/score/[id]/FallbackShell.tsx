'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useLocaleSwitch } from '@/src/i18n/LocaleProvider';
import { HTML_LANG } from '@/src/i18n/locale';
import PondRouteLink from '@/src/components/pond-shell/PondRouteLink';
import { useScoreOrigin } from '@/src/components/pond-shell/score/score-origin';

/** 无法确认作品身份时的安全壳；不伪造 Token、日期或永久资源。 */
export default function FallbackShell() {
  const t = useTranslations('score');
  const tc = useTranslations('common');
  const { locale } = useLocaleSwitch();
  const scoreOrigin = useScoreOrigin();
  useEffect(() => {
    const origin = scoreOrigin.origin;
    if (origin) scoreOrigin.clear(origin.id);
  }, [scoreOrigin]);
  return (
    <main className="score-fallback" data-p11-theme="score" data-theme="dark"
      data-score-state="fallback" lang={HTML_LANG[locale]}>
      <section className="score-fallback__content">
        <span className="score-fallback__mark" aria-hidden="true">○</span>
        <h1>{t('fallback.title')}</h1>
        <p>{t('fallback.body')}</p>
        <div className="score-fallback__actions">
          <button type="button" onClick={() => window.location.reload()}>{tc('retry')}</button>
          <PondRouteLink href="/me">{t('backToArchiveLink')}</PondRouteLink>
          <PondRouteLink href="/">{t('backToPondShort')}</PondRouteLink>
        </div>
      </section>
    </main>
  );
}
