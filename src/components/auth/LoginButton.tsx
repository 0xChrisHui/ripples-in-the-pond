'use client';

import PondRouteLink from '@/src/components/pond-shell/PondRouteLink';
import { useAuth } from '@/src/hooks/useAuth';

/**
 * 登录按钮 — 未登录显示"登录"，已登录显示"我的音乐" + 独立"登出"链接
 * "我的音乐"点击跳 /me，登出必须显式点"登出"链接
 */
export default function LoginButton() {
  const { ready, authenticated, openLoginModal, logout, evmAddress } = useAuth();
  const accountClass = 'inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full border border-white/20 px-4 py-1.5 text-sm leading-none text-white transition-colors hover:bg-white/10';

  if (!ready) return <span className="pond-account-slot" aria-busy="true" />;

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={openLoginModal}
        className={accountClass}
      >
        登录
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <PondRouteLink
        href="/me"
        className={accountClass}
        title={evmAddress ?? undefined}
      >
        我的音乐
      </PondRouteLink>
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
