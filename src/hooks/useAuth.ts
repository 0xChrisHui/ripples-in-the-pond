'use client';

import { usePrivy } from '@privy-io/react-auth';

/**
 * 封装 Privy 登录状态
 * 返回：是否已登录、evm 地址、登录/登出方法
 */
export function useAuth() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();

  const evmAddress = user?.wallet?.address ?? null;

  return {
    ready,
    authenticated,
    evmAddress,
    login,
    logout,
    getAccessToken,
  };
}
