'use client';

import Link from 'next/link';
import { useAuth } from '@/src/hooks/useAuth';

/**
 * 登录按钮 — 未登录显示"登录"，已登录显示地址缩写 + 独立"登出"链接
 * 地址按钮点击跳 /me（用户的直觉期待），登出必须显式点"登出"链接
 */
export default function LoginButton() {
  const { ready, authenticated, login, logout } = useAuth();

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

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/me"
        className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white transition-colors hover:bg-white/10"
      >
        我的音乐
      </Link>
      <button
        type="button"
        onClick={logout}
        className="text-xs text-white/40 transition-colors hover:text-white/70"
      >
        登出
      </button>
    </div>
  );
}
