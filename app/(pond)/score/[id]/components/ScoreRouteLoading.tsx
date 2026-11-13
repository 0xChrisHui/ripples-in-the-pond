'use client';

import { useTranslations } from 'next-intl';
import { useLocaleSwitch } from '@/src/i18n/LocaleProvider';
import { HTML_LANG } from '@/src/i18n/locale';
import RecordAnchor from '@/src/components/p11/RecordAnchor';
import ScoreIdentity from './hero/ScoreIdentity';
import { useScoreOrigin } from '@/src/components/pond-shell/score/score-origin';

/** 动态快照读取期间保持正式 Score 的空间结构，避免点击后停留在来源页。 */
export default function ScoreRouteLoading() {
  const t = useTranslations('score');
  const { locale } = useLocaleSwitch();
  const { origin } = useScoreOrigin();
  const tokenId = origin?.tokenId;
  const title = tokenId == null ? t('opening') : `Ripples #${tokenId}`;

  return (
    <main className="score-pond-page" data-p11-theme="score" data-theme="dark"
      data-score-state="loading" lang={HTML_LANG[locale]}>
      <section className="score-pond-page__hero">
        <ScoreIdentity title={title} subtitle={origin?.trackTitle ?? t('readingRecord')} network={t('reading')} status="processing" tokenId={tokenId} />
        <div className="score-pond-page__anchor" data-pond-ui="true">
          <RecordAnchor state="loading" title={title} coverUrl="" onAction={() => undefined}
            statusText={t('readingRecordEllipsis')} disabled />
        </div>
      </section>
    </main>
  );
}
