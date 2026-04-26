'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback } from 'react';
import { clearNftCache } from '@/src/lib/nft-cache';

/**
 * 封装 Privy 登录状态
 * 返回：是否已登录、Privy user.id、evm 地址、登录/登出方法
 *
 * Phase 6 B1：logout 前清当前用户的 NFT cache，防共享浏览器/换号串数据
 */
export function useAuth() {
  const { ready, authenticated, user, login, logout: privyLogout, getAccessToken } = usePrivy();

  const evmAddress = user?.wallet?.address ?? null;
  const userId = user?.id ?? null;

  const logout = useCallback(async () => {
    if (userId) clearNftCache(userId);
    await privyLogout();
  }, [userId, privyLogout]);

  return {
    ready,
    authenticated,
    userId,
    evmAddress,
    login,
    logout,
    getAccessToken,
  };
}
