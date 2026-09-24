'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { getAddress } from 'viem';
import { clearNftCache } from '@/src/lib/nft-cache';
import { openLoginModal } from '@/src/components/auth/LoginModal';
import {
  clearLoginSession,
  getLoginSession,
  getServerLoginSession,
  setLoginSession,
  subscribeLoginSession,
} from '@/src/components/auth/login-session';
import { clearArchiveCache } from '@/src/hooks/me/archive-cache';
import {
  clearSemiJwt,
  readSemiJwt,
  subscribeSemiJwt,
  type JwtState,
} from '@/src/lib/auth/client-jwt';
import type { ExternalWalletCheck, WalletCapability } from '@/src/types/auth';

const EMPTY_STATE: JwtState = { jwt: null, payload: null };
const DENIED: ExternalWalletCheck = {
  allowed: false,
  selfMintAllowed: false,
  walletClientType: null,
  connectorType: null,
};

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
  const { wallets, ready: walletsReady } = useWallets();
  const jwtState = useSyncExternalStore(subscribeSemiJwt, readSemiJwt, getServerSnapshot);
  const loginSession = useSyncExternalStore(
    subscribeLoginSession,
    getLoginSession,
    getServerLoginSession,
  );
  const [verifiedWallet, setVerifiedWallet] = useState<{
    address: string;
    userId: string;
    check: ExternalWalletCheck;
  } | null>(null);

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

  const recoverableWalletAddress = useMemo(() => {
    if (!privyAuth || semiAuth
      || (loginSession.loginEntry !== null && loginSession.loginEntry !== 'external_wallet') || !user) return null;
    const linkedAccounts = user.linkedAccounts;
    if (linkedAccounts.length !== 1 || linkedAccounts[0].type !== 'wallet') return null;
    const wallet = linkedAccounts[0];
    if (wallet.walletClientType === 'privy' || wallet.walletClientType === 'privy-v2'
      || wallet.connectorType === 'embedded') return null;
    try { return getAddress(wallet.address); } catch { return null; }
  }, [loginSession.loginEntry, privyAuth, semiAuth, user]);
  const loginEntry = recoverableWalletAddress ? 'external_wallet' : loginSession.loginEntry;
  const selectedWalletAddress = (() => {
    try { return getAddress(recoverableWalletAddress ?? loginSession.selectedWalletAddress ?? ''); }
    catch { return null; }
  })();

  const selectedExternalWallet = useMemo(() => {
    if (loginEntry !== 'external_wallet' || !selectedWalletAddress) return null;
    return wallets.find((wallet) => {
      if (wallet.walletClientType === 'privy' || wallet.connectorType === 'embedded') return false;
      try { return getAddress(wallet.address) === selectedWalletAddress; } catch { return false; }
    }) ?? null;
  }, [loginEntry, selectedWalletAddress, wallets]);

  useEffect(() => {
    if (loginSession.loginEntry !== 'external_wallet' && recoverableWalletAddress) {
      setLoginSession('external_wallet', recoverableWalletAddress);
    }
  }, [loginSession.loginEntry, recoverableWalletAddress]);

  useEffect(() => {
    let cancelled = false;
    if (!privyAuth || !userId || loginEntry !== 'external_wallet' || !selectedWalletAddress) return;
    void (async () => {
      const token = await privyToken();
      if (!token) return;
      const response = await fetch('/api/auth/wallet-capability', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: selectedWalletAddress }),
      });
      if (!response.ok) return;
      const result = await response.json() as ExternalWalletCheck;
      if (!cancelled) setVerifiedWallet({ address: selectedWalletAddress, userId, check: result });
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [loginEntry, privyAuth, privyToken, selectedWalletAddress, userId]);

  const serverWallet = selectedWalletAddress && verifiedWallet
    && userId === verifiedWallet.userId && selectedWalletAddress === verifiedWallet.address
    ? verifiedWallet.check : DENIED;
  const hasEmbeddedWallet = user?.linkedAccounts.some((account) => (
    account.type === 'wallet'
    && (account.walletClientType === 'privy' || account.connectorType === 'embedded')
  )) ?? false;
  const externalVerified = Boolean(
    privyAuth && loginEntry === 'external_wallet' && selectedWalletAddress && serverWallet.allowed,
  );
  const walletCapability: WalletCapability = {
    authSource,
    loginEntry,
    walletKind: externalVerified ? 'external' : hasEmbeddedWallet ? 'embedded' : 'none',
    activeWalletAddress: selectedWalletAddress,
    walletClientType: serverWallet.walletClientType ?? selectedExternalWallet?.walletClientType ?? null,
    connectorType: serverWallet.connectorType ?? selectedExternalWallet?.connectorType ?? null,
    canChooseMintChain: externalVerified && serverWallet.selfMintAllowed,
    canSelfPayEthGas: externalVerified && serverWallet.selfMintAllowed && Boolean(selectedExternalWallet),
  };

  const logout = useCallback(async () => {
    if (userId) clearNftCache(userId);
    if (userId && authSource) clearArchiveCache({ userId, authSource, evmAddress });
    clearSemiJwt();
    clearLoginSession();
    if (privyAuth) {
      await privyLogout();
    }
  }, [authSource, userId, evmAddress, privyAuth, privyLogout]);

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
    walletsReady,
    selectedExternalWallet,
    walletCapability,
    // ⚠️ login 仅作 D-B3 兼容字段保留（直接弹 Privy 原生 modal、绕过两 tab 选择）。
    // 新代码请用 openLoginModal —— 否则 Semi 用户没机会进 Semi tab 登录。
    login: privyLogin,
    openLoginModal,
    logout,
    getAccessToken,
  };
}
