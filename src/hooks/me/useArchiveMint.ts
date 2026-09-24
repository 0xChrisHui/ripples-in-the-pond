'use client';

import { useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import type { Hex } from 'viem';

export type MintChainId = 10 | 11155420 | 1 | 11155111;

const ORDER_ID = /^0x[0-9a-f]{64}$/;
const LOCATION_EVENT = 'ripples:mint-location';

function subscribeLocation(listener: () => void): () => void {
  window.addEventListener('popstate', listener);
  window.addEventListener(LOCATION_EVENT, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(LOCATION_EVENT, listener);
  };
}

function locationSearch(): string { return window.location.search; }
function serverSearch(): string { return ''; }

function configuredChains(): {
  opChainId: 10 | 11155420;
  ethereumChainId: 1 | 11155111 | null;
} {
  const opChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) === 11155420 ? 11155420 : 10;
  const candidate = Number(process.env.NEXT_PUBLIC_ETH_SCORE_CHAIN_ID);
  const ethereumChainId = candidate === 1 || candidate === 11155111 ? candidate : null;
  return { opChainId, ethereumChainId };
}

/** P16 只在档案层保存网络偏好和当前订单，不接管 P11 的路由事务。 */
export function useArchiveMint({
  userId,
  canChooseMintChain,
  onCloseOrder,
}: {
  userId: string | null;
  canChooseMintChain: boolean;
  onCloseOrder: () => void;
}) {
  usePathname();
  const { opChainId, ethereumChainId } = configuredChains();
  const [selection, setSelection] = useState<{ userId: string | null; chainId: MintChainId }>({
    userId: null,
    chainId: opChainId,
  });
  const [openedOrderId, setOpenedOrderId] = useState<Hex | null>(null);
  const search = useSyncExternalStore(subscribeLocation, locationSearch, serverSearch);
  const ethereumEnabled = Boolean(
    ethereumChainId
      && process.env.NEXT_PUBLIC_ETH_SCORE_NFT_ADDRESS
      && canChooseMintChain,
  );
  const requested = selection.userId === userId ? selection.chainId : opChainId;
  const activeChainId = ethereumEnabled && requested === ethereumChainId ? requested : opChainId;

  const queryOrderId = new URLSearchParams(search).get('mintOrder');
  const activeOrderId = openedOrderId
    ?? (queryOrderId && ORDER_ID.test(queryOrderId) ? queryOrderId as Hex : null);

  const openOrder = (orderId: Hex) => {
    setOpenedOrderId(orderId);
    window.history.replaceState(window.history.state, '', `/me?mintOrder=${orderId}`);
    window.dispatchEvent(new Event(LOCATION_EVENT));
  };
  const closeOrder = () => {
    setOpenedOrderId(null);
    if (window.location.search.includes('mintOrder=')) {
      window.history.replaceState(window.history.state, '', '/me');
      window.dispatchEvent(new Event(LOCATION_EVENT));
    }
    onCloseOrder();
  };

  return {
    opChainId,
    ethereumChainId,
    ethereumEnabled,
    activeChainId,
    activeOrderId,
    selectChain: (chainId: MintChainId) => setSelection({ userId, chainId }),
    openOrder,
    closeOrder,
  };
}
