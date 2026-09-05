'use client';

import EditionStamp from '@/src/components/p11/EditionStamp';
import RecordAnchor from '@/src/components/p11/RecordAnchor';
import ScorePondHeader from '@/src/components/p11/ScorePondHeader';
import type { ScoreFailedData, ScoreProcessingData } from '@/src/data/score-source';
import ScoreArchive from './ScoreArchive';
import ShareActions from './ShareActions';

type Props = { score: ScoreProcessingData | ScoreFailedData; network: string };

const statusLabels = {
  pending: '已进入作品制作队列',
  uploading_events: '正在保存演奏动作',
  minting_onchain: '正在写入 OP Mainnet',
  uploading_metadata: '正在装配永久作品',
  setting_uri: '正在绑定永久播放器',
  success: '永久作品已完成',
  failed: '作品制作没有完成',
} as const;

function failureMessage(score: ScoreFailedData): string {
  if (score.publicFailure === 'metadata_unavailable') return '永久资料暂时无法读取';
  if (score.publicFailure === 'queue_failed') return '这枚唱片制作未能完成';
  return '作品资料暂时不可用';
}

export default function ScoreLifecycle({ score, network }: Props) {
  const processing = score.state === 'processing';
  const title = score.tokenId == null ? 'Ripples · 制作中' : `Ripples #${score.tokenId}`;
  const tokenLabel = score.tokenId == null ? 'Pending edition' : `Token #${String(score.tokenId).padStart(3, '0')}`;
  const statusText = processing
    ? statusLabels[score.queueStatus ?? 'pending']
    : failureMessage(score);
  const detail = processing
    ? '作品身份、分享链接和已经生成的凭证会留在这里；稍后刷新即可查看进度。'
    : '已知链上身份与永久凭证仍保留在下方，可据此独立核验。';
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
          backHref="/"
          network={network}
          tokenLabel={tokenLabel}
          shareAction={<ShareActions id={score.id} tokenId={score.tokenId ?? null} trackTitle={score.trackTitle} />}
        />
        <div className="score-pond-page__identity" data-pond-ui="true">
          <EditionStamp status={processing ? 'processing' : 'failed'} detail={tokenLabel} />
          <h1>{title}</h1>
          <p>{score.trackTitle}{score.eventCount == null ? '' : ` · ${score.eventCount} 个事件`}</p>
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
              <button type="button" onClick={() => window.location.reload()}>刷新制作状态</button>
            </div>
          )}
        </div>
      </section>
      <ScoreArchive score={score} />
    </main>
  );
}
