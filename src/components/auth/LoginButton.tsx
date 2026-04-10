'use client';

import Link from 'next/link';
import { useAuth } from '@/src/hooks/useAuth';

/**
 * 登录按钮 — 未登录显示"登录"，已登录显示地址缩写，点击登出
 */
export default function LoginButton() {
  const { ready, authenticated, evmAddress, login, logout } = useAuth();

  if (!ready) return null;

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={login}
        className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white transition-colors hover:bg-white/10"
      >
        登录
      </button>
    );
  }

  const short = evmAddress
    ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}`
    : '已登录';

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/me"
        className="text-xs text-white/40 transition-colors hover:text-white/70"
      >
        我的收藏
      </Link>
      <button
        type="button"
        onClick={logout}
        className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white transition-colors hover:bg-white/10"
      >
        {short}
      </button>
    </div>
  );
}
