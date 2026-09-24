'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Hex } from 'viem';
import { useArchiveMint, type MintChainId } from '@/src/hooks/me/useArchiveMint';
import type { WalletCapability } from '@/src/types/auth';
import MintNetworkSelector from '../MintNetworkSelector';
import SelfMintOrderView from '../SelfMintOrderView';

type ArchiveMintContextValue = {
  chainId: MintChainId;
  openOrder: (orderId: Hex) => void;
  network: {
    opChainId: 10 | 11155420;
    ethereumChainId: 1 | 11155111 | null;
    ethereumEnabled: boolean;
    selectChain: (chainId: MintChainId) => void;
  };
};

const ArchiveMintContext = createContext<ArchiveMintContextValue | null>(null);

export function useArchiveMintContext(): ArchiveMintContextValue {
  const value = useContext(ArchiveMintContext);
  if (!value) throw new Error('ArchiveMintProvider 缺失');
  return value;
}

export function ArchiveMintNetworkControl() {
  const value = useContext(ArchiveMintContext);
  if (!value) return null;
  const network = value.network;
  return (
    <div className="me-archive__network-control">
      <MintNetworkSelector value={value.chainId} {...network} onChange={network.selectChain} />
    </div>
  );
}

export default function ArchiveMintProvider({
  userId,
  walletCapability,
  onOrderClosed,
  children,
}: {
  userId: string | null;
  walletCapability: WalletCapability;
  onOrderClosed: () => void;
  children: ReactNode;
}) {
  const mint = useArchiveMint({
    userId,
    canChooseMintChain: walletCapability.canChooseMintChain,
    onCloseOrder: onOrderClosed,
  });
  const value = {
    chainId: mint.activeChainId,
    openOrder: mint.openOrder,
    network: {
      opChainId: mint.opChainId,
      ethereumChainId: mint.ethereumChainId,
      ethereumEnabled: mint.ethereumEnabled,
      selectChain: mint.selectChain,
    },
  };
  return (
    <ArchiveMintContext.Provider value={value}>
      {children}
      {mint.activeOrderId && (
        <SelfMintOrderView orderId={mint.activeOrderId} onClose={mint.closeOrder} />
      )}
    </ArchiveMintContext.Provider>
  );
}
