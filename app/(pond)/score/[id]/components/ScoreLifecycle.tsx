'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useLocaleSwitch } from '@/src/i18n/LocaleProvider';
import { HTML_LANG } from '@/src/i18n/locale';
import RecordAnchor from '@/src/components/p11/RecordAnchor';
import ScoreIdentity from './hero/ScoreIdentity';
import { useScoreLifecyclePolling } from '@/src/hooks/score/useScoreLifecyclePolling';
import type { ScoreFailedData, ScoreProcessingData } from '@/src/data/score-source';
import ScoreArchive from './ScoreArchive';
import ShareActions from './ShareActions';
import { useScoreOrigin } from '@/src/components/pond-shell/score/score-origin';
import { buildScoreRoute } from '@/src/lib/chain/multichain/registry';

type Props = { score: ScoreProcessingData | ScoreFailedData; network: string };
const steps = ['pending', 'uploading_events', 'preparing_package', 'minting_onchain', 'uploading_metadata', 'setting_uri', 'finalizing_snapshot'] as const;

// 队列状态文案在词典 score.queue.<status>，失败原因在 score.failure.<kind>
function failureKey(score: ScoreFailedData) {
  if (score.publicFailure === 'snapshot_unavailable') return 'snapshot_unavailable' as const;
  if (score.publicFailure === 'metadata_unavailable') return 'metadata_unavailable' as const;
  if (score.publicFailure === 'queue_failed') return 'queue_failed' as const;
  return 'other' as const;
}

export default function ScoreLifecycle({ score, network }: Props) {
  const t = useTranslations('score');
  const router = useRouter();
  const { locale } = useLocaleSwitch();
  const scoreOrigin = useScoreOrigin();
  useEffect(() => {
    const origin = scoreOrigin.origin;
    if (origin?.stage === 'forward') scoreOrigin.clear(origin.id);
  }, [scoreOrigin]);
  const processing = score.state === 'processing';
  useScoreLifecyclePolling(processing);
  const snapshotUnavailable = !processing && score.publicFailure === 'snapshot_unavailable';
  const title = score.tokenId == null ? t('inProgressTitle') : `Ripples #${score.tokenId}`;
  const multichain = Boolean(score.tokenId && score.chainId && score.contractAddress);
  const canonicalPath = multichain
    ? buildScoreRoute(score.chainId!, score.contractAddress!, score.tokenId!)
    : `/score/${score.tokenId ?? score.id}`;
  const statusText = processing
    ? t(`queue.${score.queueStatus ?? 'pending'}`)
    : t(`failure.${failureKey(score)}`);
  const detail = processing
    ? t('detail.processing')
    : snapshotUnavailable
      ? t('detail.snapshotUnavailable')
      : t('detail.failed');
  return (
    <main
      className="score-pond-page score-pond-page--lifecycle"
      data-p11-theme="score"
      data-theme="dark"
      data-score-state={score.state}
      lang={HTML_LANG[locale]}
    >
      <section className="score-pond-page__hero">
        <ScoreIdentity title={title} subtitle={score.trackTitle === title ? undefined : score.trackTitle}
          network={network} status={processing ? 'processing' : snapshotUnavailable ? 'degraded' : 'failed'} tokenId={score.tokenId} />
        <div className="score-pond-page__anchor" data-pond-ui="true">
          <RecordAnchor
            state={processing ? 'loading' : 'error'}
            title={title}
            coverUrl={score.coverUrl}
            onAction={() => router.refresh()}
            statusText={statusText}
            detailText={detail}
            disabled={processing}
          />
          {processing && (
            <div className="score-fallback__actions">
              <button type="button" onClick={() => router.refresh()}>{t('refreshStatus')}</button>
            </div>
          )}
        </div>
        {processing && <ol className="score-lifecycle__steps" aria-label={t('productionSteps')}>
          {steps.map((step) => <li key={step} aria-current={step === (score.queueStatus ?? 'pending') ? 'step' : undefined}>{t(`queue.${step}`)}</li>)}
        </ol>}
        <ShareActions id={score.id} tokenId={score.tokenId ?? null} trackTitle={score.trackTitle}
          canonicalPath={canonicalPath} posterPath={multichain ? null : undefined} creatorAddress={score.creatorAddress} />
      </section>
      <ScoreArchive score={score} />
    </main>
  );
}
