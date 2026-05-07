'use client';

/**
 * SkeletonRows — 通用 pulse 骨架屏
 *
 * 给 DraftSection / ScoreNftSection 复用，消除"先空再有"3-5s 闪烁。
 */
export default function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={`skel-${i}`}
          className="h-20 animate-pulse rounded-lg border border-white/5 bg-white/[0.02]"
        />
      ))}
    </>
  );
}
