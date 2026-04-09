'use client';

import { useEffect } from 'react';
import { useAuth } from '@/src/hooks/useAuth';

/**
 * 登录按钮 — 未登录显示"登录"，已登录显示地址缩写，点击登出
 */
export default function LoginButton() {
  const { ready, authenticated, evmAddress, login, logout, getAccessToken } = useAuth();

  // 登录后自动打印 token 到 console，方便 curl 测试（Phase 1 删掉）
  useEffect(() => {
    if (!authenticated) return;
    if (evmAddress) console.log('evm_address:', evmAddress);
    getAccessToken().then((t) => { if (t) console.log('privy_token:', t); });
  }, [authenticated, evmAddress, getAccessToken]);

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
    <button
      type="button"
      onClick={logout}
      className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white transition-colors hover:bg-white/10"
    >
      {short}
    </button>
  );
}
