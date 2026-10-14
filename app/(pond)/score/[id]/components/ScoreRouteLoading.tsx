'use client';

import { useTranslations } from 'next-intl';
import { useLocaleSwitch } from '@/src/i18n/LocaleProvider';
import { HTML_LANG } from '@/src/i18n/locale';
import EditionStamp from '@/src/components/p11/EditionStamp';
import RecordAnchor from '@/src/components/p11/RecordAnchor';
import ScorePondHeader from '@/src/components/p11/ScorePondHeader';
import { useScoreOrigin } from '@/src/components/pond-shell/score/score-origin';

/** 动态快照读取期间保持正式 Score 的空间结构，避免点击后停留在来源页。 */
export default function ScoreRouteLoading() {
  const t = useTranslations('score');
  const { locale } = useLocaleSwitch();
  const { origin } = useScoreOrigin();
  const tokenId = origin?.tokenId;
  const title = tokenId == null ? t('opening') : `Ripples #${tokenId}`;
  const tokenLabel = tokenId == null
    ? 'Permanent record'
    : `Token #${String(tokenId).padStart(3, '0')}`;

  return (
    <main className="score-pond-page" data-p11-theme="score" data-theme="dark"
      data-score-state="loading" lang={HTML_LANG[locale]}>
      <section className="score-pond-page__hero">
        <ScorePondHeader backHref="/me" backLabel={t('backToArchive')} network={t('reading')}
          tokenLabel={tokenLabel} shareAction={<span aria-hidden="true" />} />
        <div className="score-pond-page__identity" data-pond-ui="true">
          <EditionStamp status="processing" detail={tokenLabel} />
          <h1>{title}</h1>
          <p>{origin?.trackTitle ?? t('readingRecord')}</p>
        </div>
        <div className="score-pond-page__anchor" data-pond-ui="true">
          <RecordAnchor state="loading" title={title} coverUrl="" onAction={() => undefined}
            statusText={t('readingRecordEllipsis')} disabled />
        </div>
      </section>
    </main>
  );
}
