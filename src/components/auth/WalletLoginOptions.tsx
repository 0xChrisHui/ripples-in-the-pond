'use client';

import {
  useConnectWallet,
  useWallets,
  type ConnectedWallet,
  type WalletListEntry,
} from '@privy-io/react-auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAddress } from 'viem';
import { setLoginSession } from './login-session';

type FlowState = 'idle' | 'connecting' | 'signing';

function isMobileWalletFlow(): boolean {
  return window.matchMedia('(pointer: coarse)').matches
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function WalletLoginOptions({
  enabled,
  onSuccess,
}: {
  enabled: boolean;
  onSuccess: () => void;
}) {
  const { wallets, ready } = useWallets();
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const [flow, setFlow] = useState<FlowState>('idle');
  const [error, setError] = useState<string | null>(null);
  const authenticating = useRef(false);

  const { connectWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => {
      if (wallet.type !== 'ethereum') {
        setFlow('idle');
        setError('请选择 EVM 钱包。');
        return;
      }
      setPendingAddress(getAddress(wallet.address));
      setFlow('signing');
    },
    onError: () => {
      setFlow('idle');
      setError('钱包连接已取消或失败，请重试。');
    },
  });

  const authenticate = useCallback(async (wallet: ConnectedWallet) => {
    authenticating.current = true;
    setPendingAddress(null);
    try {
      await wallet.loginOrLink();
      setLoginSession('external_wallet', getAddress(wallet.address));
      onSuccess();
    } catch {
      setError('钱包已连接，但登录签名未完成。');
      setFlow('idle');
    } finally {
      authenticating.current = false;
    }
  }, [onSuccess]);

  useEffect(() => {
    if (!pendingAddress || authenticating.current) return;
    const wallet = wallets.find((item) => {
      try { return getAddress(item.address) === pendingAddress; } catch { return false; }
    });
    if (wallet) void authenticate(wallet);
  }, [authenticate, pendingAddress, wallets]);

  if (!enabled) return null;
  const busy = flow !== 'idle' || !ready;

  const start = () => {
    setError(null);
    setFlow('connecting');
    const walletList: WalletListEntry[] = [
      'metamask',
      isMobileWalletFlow() ? 'wallet_connect' : 'wallet_connect_qr',
      'phantom',
      'okx_wallet',
    ];
    connectWallet({ walletList, walletChainType: 'ethereum-only' });
  };

  return (
    <div className="auth-dialog__wallets">
      <button type="button" className="auth-dialog__email" disabled={busy}
        data-login-autofocus
        onClick={start}>
        用链上钱包登录
      </button>
      <p className="auth-dialog__wallet-note" aria-live="polite">
        {flow === 'connecting' && '正在连接钱包…'}
        {flow === 'signing' && '请在钱包中签名完成登录…'}
        {flow === 'idle' && '钱包登录需要一次免费签名，不会发起交易。'}
      </p>
      {error && <p className="semi-login__error" role="alert">{error}</p>}
    </div>
  );
}
