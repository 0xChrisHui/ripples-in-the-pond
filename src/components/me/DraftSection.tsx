'use client';

import DraftCard from './DraftCard';
import SkeletonRows from './SkeletonRows';
import type { Track } from '@/src/types/tracks';
import type { KeyEvent } from '@/src/types/jam';

/** 「我的创作」UI 行的显示数据（跟 me/page 共用） */
export interface DisplayDraft {
  key: string;
  title: string;
  pendingScoreId?: string;
  /** server 草稿才有（▶ 播放用，PlayerProvider.toggle）*/
  track?: Track;
  /** server 草稿才有（useEventsPlayback 按时间触发音效）*/
  events?: KeyEvent[];
}

/**
 * "我的创作"段（B8 简化）
 *
 * showSkeleton：authenticated 但服务端 drafts 还没回来时显示 3 张占位卡，
 * 消除"先空再有"3-5s 闪烁。
 */
export default function DraftSection({
  drafts,
  showSkeleton,
}: {
  drafts: DisplayDraft[];
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
            pendingScoreId={d.pendingScoreId}
            track={d.track}
            events={d.events}
          />
        ))}
        {showSkeleton && drafts.length === 0 && <SkeletonRows count={3} />}
      </div>
    </section>
  );
}
