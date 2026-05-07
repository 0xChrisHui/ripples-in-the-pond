'use client';

import DraftCard from './DraftCard';
import SkeletonRows from './SkeletonRows';
import type { MintingState } from '@/src/types/jam';

interface DraftItem {
  key: string;
  title: string;
  expiresAt: string;
  pendingScoreId?: string;
  mintingState?: MintingState;
}

/**
 * "我的创作"段（B2 P1 5/6 从 me/page 抽出）
 *
 * showSkeleton：authenticated 但服务端 drafts 还没回来时显示 3 张占位卡，
 * 消除"先空再有"3-5s 闪烁（Bug B 修复）。
 */
export default function DraftSection({
  drafts,
  showSkeleton,
}: {
  drafts: DraftItem[];
  showSkeleton: boolean;
}) {
  if (drafts.length === 0 && !showSkeleton) return null;

  return (
    <section className="mt-12">
      <h2 className="mb-4 text-sm font-light tracking-widest text-white/60">
        我的创作
      </h2>
      <div className="grid gap-3">
        {drafts.map((d) => (
          <DraftCard
            key={d.key}
            title={d.title}
            expiresAt={d.expiresAt}
            pendingScoreId={d.pendingScoreId}
            mintingState={d.mintingState}
          />
        ))}
        {showSkeleton && drafts.length === 0 && <SkeletonRows count={3} />}
      </div>
    </section>
  );
}
