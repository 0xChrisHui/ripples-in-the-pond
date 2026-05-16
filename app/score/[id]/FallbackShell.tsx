'use client';

import Link from 'next/link';

/**
 * A10 — /score/[id] 链上灾备降级壳
 * DB miss（Supabase 抖动 / ID 不存在）时显示此页，不直接 404。
 * Phase 9/10 可在此接入链上 tokenURI fallback。
 */
export default function FallbackShell() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black">
      <p className="text-4xl text-white/20">♫</p>
      <p className="text-sm text-white/50">乐谱暂时无法加载，请稍后刷新</p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full border border-white/20 px-5 py-2 text-xs text-white/60 hover:bg-white/10"
        >
          刷新页面
        </button>
        <Link
          href="/me"
          className="rounded-full border border-white/10 px-5 py-2 text-xs text-white/30 hover:text-white/50"
        >
          ← 我的收藏
        </Link>
      </div>
    </main>
  );
}
