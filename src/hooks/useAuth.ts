'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useSyncExternalStore } from 'react';
import { clearNftCache } from '@/src/lib/nft-cache';
import { openLoginModal } from '@/src/components/auth/LoginModal';
import {
  clearSemiJwt,
  readSemiJwt,
  subscribeSemiJwt,
  type JwtState,
} from '@/src/lib/auth/client-jwt';

const EMPTY_STATE: JwtState = { jwt: null, payload: null };

function getServerSnapshot(): JwtState {
  return EMPTY_STATE;
}

/**
 * 封装 Privy + Semi 双源登录（Phase 7 Track B B3）
 *
 * - Privy authenticated 优先；否则查 localStorage 的 Semi JWT（前端 atob 自校验 exp）
 * - getAccessToken 双源：Privy → privy.getAccessToken / Semi → localStorage JWT
 * - logout 双源都清（playbook D-B5）
 * - 跨 tab：storage event 自动同步（client-jwt.ts 内挂的）
 *
 * Phase 6 B1：logout 前清当前用户的 NFT cache，防共享浏览器/换号串数据
 */
export function useAuth() {
  const { ready: privyReady, authenticated: privyAuth, user, login: privyLogin, logout: privyLogout, getAccessToken: privyToken } = usePrivy();
  const jwtState = useSyncExternalStore(subscribeSemiJwt, readSemiJwt, getServerSnapshot);

  const semiAuth = jwtState.jwt !== null && jwtState.payload !== null;

  // ready 双源：Privy SDK 初始化慢 / 失败时，已有 Semi JWT 的回访用户不应该看到 UI 空白
  // （LoginButton / /me 都在 ready=false 时返 null）。codex review 2026-05-15 P1。
  const ready = privyReady || semiAuth;

  let authSource: 'privy' | 'semi' | null = null;
  let userId: string | null = null;
  let evmAddress: string | null = null;

  if (privyAuth) {
    authSource = 'privy';
    userId = user?.id ?? null;
    evmAddress = user?.wallet?.address ?? null;
  } else if (semiAuth) {
    authSource = 'semi';
    userId = jwtState.payload!.sub;
    evmAddress = jwtState.payload!.evm;
  }

  const authenticated = authSource !== null;

  const logout = useCallback(async () => {
    if (userId) clearNftCache(userId);
    clearSemiJwt();
    if (privyAuth) {
      await privyLogout();
    }
  }, [userId, privyAuth, privyLogout]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (authSource === 'privy') return privyToken();
    if (authSource === 'semi') return jwtState.jwt;
    return null;
  }, [authSource, jwtState.jwt, privyToken]);

  return {
    ready,
    authenticated,
    authSource,
    userId,
    evmAddress,
    // ⚠️ login 仅作 D-B3 兼容字段保留（直接弹 Privy 原生 modal、绕过两 tab 选择）。
    // 新代码请用 openLoginModal —— 否则 Semi 用户没机会进 Semi tab 登录。
    login: privyLogin,
    openLoginModal,
    logout,
    getAccessToken,
  };
}
