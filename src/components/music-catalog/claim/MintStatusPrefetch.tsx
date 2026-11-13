'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { MINT_RECORDED_EVENT } from '../../../lib/mint-notice';
import { clearMintCache, loadMintStatus, type MintIdentity } from './mint-status-cache';

/** 进入 /lens 等场景时调用：立即重新批量核对一次（后台进行，界面不等待）。 */
const REFRESH_EVENT = 'pond:mint-status-refresh';
export function requestMintStatusRefresh(): void {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

/** 当前登录身份的铸造查询参数（OP 用 userId，以太坊用外部钱包地址）。 */
export function mintIdentityOf(auth: ReturnType<typeof useAuth>): MintIdentity | null {
  if (!auth.authenticated || !auth.userId) return null;
  const wallet = auth.walletCapability.walletKind === 'external' ? auth.selectedExternalWallet?.address ?? null : null;
  return { userId: auth.userId, wallet, getToken: () => auth.getAccessToken() };
}

/**
 * 登录后批量预取本人全部原曲的铸造状态，进入 /lens 时再核对一次；无界面，挂在全局 Providers。
 * 面板只读缓存，悬停即显示结果。
 */
export default function MintStatusPrefetch() {
  const auth = useAuth();
  // 回调每次渲染都会变；用 ref 取最新值，避免重复触发。
  const latest = useRef(auth);
  useEffect(() => { latest.current = auth; });
  useEffect(() => {
    const refresh = (event: Event) => {
      const identity = mintIdentityOf(latest.current);
      if (identity) void loadMintStatus(identity, event.type === MINT_RECORDED_EVENT);
    };
    window.addEventListener(REFRESH_EVENT, refresh);
    window.addEventListener(MINT_RECORDED_EVENT, refresh);
    return () => {
      window.removeEventListener(REFRESH_EVENT, refresh);
      window.removeEventListener(MINT_RECORDED_EVENT, refresh);
    };
  }, []);
  const { ready, authenticated, userId, walletCapability, selectedExternalWallet } = auth;
  const wallet = walletCapability.walletKind === 'external' ? selectedExternalWallet?.address ?? null : null;
  const identity = authenticated && userId ? `${userId}|${wallet ?? ''}` : null;

  useEffect(() => {
    if (!ready) return;
    const current = mintIdentityOf(latest.current);
    if (!current) { clearMintCache(); return; }
    void loadMintStatus(current);
  }, [ready, identity]);

  return null;
}
