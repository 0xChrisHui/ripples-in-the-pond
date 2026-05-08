'use client';

import type { OwnedScoreNFT } from '@/src/types/jam';
import ScoreCard from './ScoreCard';
import SkeletonRows from './SkeletonRows';

/**
 * "我的唱片" section（B2 P1 review P2 抽出）
 *
 * showSkeleton：authenticated 但 fetchMyScoreNFTs 还没回来时显示 3 张占位卡，
 * 消除"先空再有"3-5s 闪烁（与 DraftSection 对称）。
 */
export default function ScoreNftSection({
  scoreNfts,
  showSkeleton,
}: {
  scoreNfts: OwnedScoreNFT[];
  showSkeleton: boolean;
}) {
  if (scoreNfts.length === 0 && !showSkeleton) return null;

  return (
    <section>
      <h2 className="mb-4 text-sm font-light tracking-widest text-white/60">
        我的唱片
      </h2>
      <div className="grid gap-3">
        {scoreNfts.length > 0 ? (
          scoreNfts.map((s) => <ScoreCard key={s.queueId} score={s} />)
        ) : (
          <SkeletonRows count={3} />
        )}
      </div>
    </section>
  );
}
