'use client';

import { useAuth } from '@/src/hooks/useAuth';
import { useMint } from '@/src/hooks/useMint';

/**
 * 铸造按钮 — 登录后显示，点击调 mint API
 */
export default function MintButton({ tokenId }: { tokenId: number }) {
  const { authenticated, openLoginModal } = useAuth();
  const { status, mint } = useMint();

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={openLoginModal}
        className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/40 transition-colors hover:border-white/30 hover:text-white/70"
      >
        登录后铸造
      </button>
    );
  }

  if (status === 'success') {
    return (
      <span className="text-xs text-emerald-400">已铸造 ✓</span>
    );
  }

  if (status === 'minting') {
    return (
      <span className="text-xs text-white/50">铸造中…</span>
    );
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={() => mint(tokenId)}
        className="rounded-full border border-red-500/30 px-3 py-1 text-xs text-red-400 transition-colors hover:border-red-500/50"
      >
        重试
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => mint(tokenId)}
      className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/40 transition-colors hover:border-white/30 hover:text-white/70"
    >
      铸造
    </button>
  );
}
