'use client';

import { useConnectWallet, useWallets, type WalletListEntry } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getAddress } from 'viem';
import { setLoginSession } from '@/src/components/auth/login-session';

/** 登录仍有效但扩展钱包断开时，明确恢复原钱包，绝不改用另一个收款地址。 */
export default function ReconnectMintWallet({ expectedAddress, walletClientType }: {
  expectedAddress: string; walletClientType?: string | null;
}) {
  const { wallets } = useWallets();
  const t = useTranslations('selfMint.reconnect');
  const [busy, setBusy] = useState(false);
  // 只存错误类别与原因，渲染时取词：切换语言后提示同步换语言
  const [error, setError] = useState<{ key: 'wrongWallet' | 'connectFailed' | 'connectFailedReason'; reason?: string } | null>(null);
  const isMetaMask = walletClientType?.toLowerCase() === 'metamask';

  useEffect(() => {
    if (!busy) return;
    const connected = wallets.some((wallet) => {
      try { return getAddress(wallet.address) === getAddress(expectedAddress); }
      catch { return false; }
    });
    if (connected) { setBusy(false); setError(null); }
  }, [busy, expectedAddress, wallets]);
  const { connectWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => {
      try {
        if (wallet.type !== 'ethereum'
          || getAddress(wallet.address) !== getAddress(expectedAddress)) {
          setError({ key: 'wrongWallet' });
          return;
        }
        setLoginSession('external_wallet', getAddress(expectedAddress));
        setError(null);
      } catch {
        setError({ key: 'connectFailed' });
      } finally {
        setBusy(false);
      }
    },
    onError: (reason) => {
      setBusy(false);
      setError({ key: 'connectFailedReason', reason: String(reason) });
    },
  });

  const start = () => {
    setBusy(true);
    setError(null);
    const walletList: WalletListEntry[] = isMetaMask ? ['metamask'] : [
      'metamask', 'wallet_connect', 'wallet_connect_qr', 'phantom', 'okx_wallet',
    ];
    connectWallet({ walletList, walletChainType: 'ethereum-only',
      description: t('description', { address: `${expectedAddress.slice(0, 6)}…${expectedAddress.slice(-4)}` }),
      ...(isMetaMask ? { preSelectedWalletId: 'metamask' } : {}),
    });
  };

  return (
    <>
      <button type="button" disabled={busy} onClick={start}>
        {busy ? t('connecting') : isMetaMask ? t('metamask') : t('reconnect')}
      </button>
      {error && <p role="alert">{t(error.key, { reason: error.reason ?? '' })}</p>}
    </>
  );
}
