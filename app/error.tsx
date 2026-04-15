"use client";

/** 全局错误边界 — 页面崩溃时显示友好提示 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Phase 7 接 Sentry 后这里会上报
  console.error("[GlobalError]", error);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <h1 className="text-4xl font-bold">出了点问题</h1>
      <p className="mt-4 text-gray-400">页面遇到了一个错误</p>
      <button
        onClick={reset}
        className="mt-8 rounded-full border border-white/20 px-6 py-2 text-sm transition-colors hover:bg-white/10"
      >
        重试
      </button>
    </div>
  );
}
