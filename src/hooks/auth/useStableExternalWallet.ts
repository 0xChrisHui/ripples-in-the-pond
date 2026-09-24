'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ConnectedWallet } from '@privy-io/react-auth';
import { getAddress } from 'viem';

export function useStableExternalWallet(input: {
  loginEntry: string | null;
  selectedWalletAddress: string | null;
  wallets: ConnectedWallet[];
  walletsReady: boolean;
}): ConnectedWallet | null {
  const { loginEntry, selectedWalletAddress, wallets, walletsReady } = input;
  const [stableWallet, setStableWallet] = useState<ConnectedWallet | null>(null);
  const matchedWallet = useMemo(() => {
    if (loginEntry !== 'external_wallet' || !selectedWalletAddress) return null;
    return wallets.find((wallet) => {
      if (wallet.walletClientType === 'privy' || wallet.connectorType === 'embedded') return false;
      try { return getAddress(wallet.address) === selectedWalletAddress; } catch { return false; }
    }) ?? null;
  }, [loginEntry, selectedWalletAddress, wallets]);

  useEffect(() => {
    let cancelled = false;
    if (matchedWallet) {
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        setStableWallet((current) => {
          try {
            return current && getAddress(current.address) === getAddress(matchedWallet.address)
              ? current : matchedWallet;
          } catch { return matchedWallet; }
        });
      }, 0);
      return () => { cancelled = true; window.clearTimeout(timer); };
    }
    if (!walletsReady || !stableWallet) return;
    void stableWallet.isConnected().then((connected) => {
      if (!cancelled && !connected) {
        setStableWallet((current) => current === stableWallet ? null : current);
      }
    }).catch(() => {
      if (!cancelled) setStableWallet((current) => current === stableWallet ? null : current);
    });
    return () => { cancelled = true; };
  }, [matchedWallet, stableWallet, walletsReady]);

  return loginEntry === 'external_wallet' && selectedWalletAddress ? stableWallet : null;
}
