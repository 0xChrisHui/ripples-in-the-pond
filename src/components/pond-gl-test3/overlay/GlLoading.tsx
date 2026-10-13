'use client';

/**
 * GL 水塘加载失败浮层：只在失败时出现，提供重试按钮。
 * 加载期不再出任何文字，由 SceneCover 作为唯一过渡层。pointer-events 仅按钮接管。
 */
export default function GlLoading({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center gap-2 text-center">
      <button
        type="button"
        onClick={onRetry}
        className="pointer-events-auto rounded border border-white/15 bg-white/5 px-4 py-2 text-[13px] text-white/80 hover:bg-white/10"
      >
        加载失败，点击重试
      </button>
    </div>
  );
}
