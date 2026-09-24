'use client';

import { useConnectWallet, useWallets, type WalletListEntry } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { getAddress } from 'viem';
import { setLoginSession } from '@/src/components/auth/login-session';

/** 登录仍有效但扩展钱包断开时，明确恢复原钱包，绝不改用另一个收款地址。 */
export default function ReconnectMintWallet({ expectedAddress, walletClientType }: {
  expectedAddress: string; walletClientType?: string | null;
}) {
  const { wallets } = useWallets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          throw new Error('请连接这笔订单原来的 EVM 钱包。');
        }
        setLoginSession('external_wallet', getAddress(expectedAddress));
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : '钱包连接未完成，请重试。');
      } finally {
        setBusy(false);
      }
    },
    onError: (reason) => {
      setBusy(false);
      setError(`钱包连接未完成（${String(reason)}）。请确认小狐狸已解锁，并选择原钱包地址。`);
    },
  });

  const start = () => {
    setBusy(true);
    setError(null);
    const walletList: WalletListEntry[] = isMetaMask ? ['metamask'] : [
      'metamask', 'wallet_connect', 'wallet_connect_qr', 'phantom', 'okx_wallet',
    ];
    connectWallet({ walletList, walletChainType: 'ethereum-only',
      description: `请连接订单原钱包 ${expectedAddress.slice(0, 6)}…${expectedAddress.slice(-4)}`,
      ...(isMetaMask ? { preSelectedWalletId: 'metamask' } : {}),
    });
  };

  return (
    <>
      <button type="button" disabled={busy} onClick={start}>
        {busy ? '正在连接钱包…' : isMetaMask ? '连接原 MetaMask 钱包' : '重新连接原钱包'}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
