'use client';

import EditionStamp from '@/src/components/p11/EditionStamp';
import RecordAnchor from '@/src/components/p11/RecordAnchor';
import ScorePondHeader from '@/src/components/p11/ScorePondHeader';
import { useScoreOrigin } from '@/src/components/pond-shell/score/score-origin';

/** 动态快照读取期间保持正式 Score 的空间结构，避免点击后停留在来源页。 */
export default function ScoreRouteLoading() {
  const { origin } = useScoreOrigin();
  const tokenId = origin?.tokenId;
  const title = tokenId == null ? '正在打开永久唱片' : `Ripples #${tokenId}`;
  const tokenLabel = tokenId == null
    ? 'Permanent record'
    : `Token #${String(tokenId).padStart(3, '0')}`;

  return (
    <main className="score-pond-page" data-p11-theme="score" data-theme="dark"
      data-score-state="loading" lang="zh-CN">
      <section className="score-pond-page__hero">
        <ScorePondHeader backHref="/me" backLabel="返回档案" network="正在读取"
          tokenLabel={tokenLabel} shareAction={<span aria-hidden="true" />} />
        <div className="score-pond-page__identity" data-pond-ui="true">
          <EditionStamp status="processing" detail={tokenLabel} />
          <h1>{title}</h1>
          <p>{origin?.trackTitle ?? '正在读取永久唱片'}</p>
        </div>
        <div className="score-pond-page__anchor" data-pond-ui="true">
          <RecordAnchor state="loading" title={title} coverUrl="" onAction={() => undefined}
            statusText="正在读取永久唱片…" disabled />
        </div>
      </section>
    </main>
  );
}
