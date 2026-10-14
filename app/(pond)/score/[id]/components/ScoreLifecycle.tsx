'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import EditionStamp from '@/src/components/p11/EditionStamp';
import RecordAnchor from '@/src/components/p11/RecordAnchor';
import ScorePondHeader from '@/src/components/p11/ScorePondHeader';
import type { ScoreFailedData, ScoreProcessingData } from '@/src/data/score-source';
import ScoreArchive from './ScoreArchive';
import ShareActions from './ShareActions';
import { useScoreOrigin } from '@/src/components/pond-shell/score/score-origin';
import { buildScoreRoute } from '@/src/lib/chain/multichain/registry';

type Props = { score: ScoreProcessingData | ScoreFailedData; network: string };

// 队列状态文案在词典 score.queue.<status>，失败原因在 score.failure.<kind>
function failureKey(score: ScoreFailedData) {
  if (score.publicFailure === 'snapshot_unavailable') return 'snapshot_unavailable' as const;
  if (score.publicFailure === 'metadata_unavailable') return 'metadata_unavailable' as const;
  if (score.publicFailure === 'queue_failed') return 'queue_failed' as const;
  return 'other' as const;
}

export default function ScoreLifecycle({ score, network }: Props) {
  const t = useTranslations('score');
  const scoreOrigin = useScoreOrigin();
  useEffect(() => {
    const origin = scoreOrigin.origin;
    if (origin?.stage === 'forward') scoreOrigin.clear(origin.id);
  }, [scoreOrigin]);
  const processing = score.state === 'processing';
  const snapshotUnavailable = !processing && score.publicFailure === 'snapshot_unavailable';
  const title = score.tokenId == null ? t('inProgressTitle') : `Ripples #${score.tokenId}`;
  const multichain = Boolean(score.tokenId && score.chainId && score.contractAddress);
  const canonicalPath = multichain
    ? buildScoreRoute(score.chainId!, score.contractAddress!, score.tokenId!)
    : `/score/${score.tokenId ?? score.id}`;
  const tokenLabel = score.tokenId == null ? 'Pending edition' : `Token #${String(score.tokenId).padStart(3, '0')}`;
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
      lang="zh-CN"
    >
      <section className="score-pond-page__hero">
        <ScorePondHeader
          backHref="/me"
          backLabel={t('backToArchive')}
          network={network}
          tokenLabel={tokenLabel}
          shareAction={<ShareActions id={score.id} tokenId={score.tokenId ?? null}
            trackTitle={score.trackTitle} canonicalPath={canonicalPath}
            posterPath={multichain ? null : undefined} creatorAddress={score.creatorAddress} />}
        />
        <div className="score-pond-page__identity" data-pond-ui="true">
          <EditionStamp status={processing ? 'processing' : snapshotUnavailable ? 'degraded' : 'failed'} detail={tokenLabel} />
          <h1>{title}</h1>
          <p>{score.trackTitle}{score.eventCount == null ? '' : t('eventCount', { count: score.eventCount })}</p>
        </div>
        <div className="score-pond-page__anchor" data-pond-ui="true">
          <RecordAnchor
            state={processing ? 'loading' : 'error'}
            title={title}
            coverUrl={score.coverUrl}
            onAction={() => window.location.reload()}
            statusText={statusText}
            detailText={detail}
            disabled={processing}
          />
          {processing && (
            <div className="score-fallback__actions">
              <button type="button" onClick={() => window.location.reload()}>{t('refreshStatus')}</button>
            </div>
          )}
        </div>
      </section>
      <ScoreArchive score={score} />
    </main>
  );
}
